"""Ask the analysis assistant a question about one completed analysis."""

import uuid
from types import SimpleNamespace
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.agents.assistant import (
    AssistantAnswer,
    Dossier,
    DossierFinding,
    render_dossier,
    system_prompt,
)
from app.agents.brief import build_brief
from app.agents.specs import AGENTS
from app.core import ratelimit
from app.core.config import get_settings
from app.core.errors import AppError, NotFound
from app.core.permissions import Permission
from app.llm import LLMError, LLMRequest, get_provider
from app.models import (
    AgentRun,
    Analysis,
    AnalysisStatus,
    Decision,
    DecisionQuestion,
    Finding,
)
from app.orgs.deps import OrgContext, require

router = APIRouter(tags=["assistant"])
CanRead = Annotated[OrgContext, Depends(require(Permission.DECISIONS_READ))]
_ORDER = {spec.key: i for i, spec in enumerate(AGENTS)}


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=6000)


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    history: list[Turn] = Field(default_factory=list, max_length=12)


class Citation(BaseModel):
    ref: int
    agent: str
    title: str
    severity: int
    finding_id: uuid.UUID


class AskOut(BaseModel):
    answer: str
    citations: list[Citation]
    confidence: str
    simulated: bool
    model: str | None


@router.post("/orgs/{org_id}/analyses/{analysis_id}/ask", response_model=AskOut)
def ask(analysis_id: uuid.UUID, body: AskIn, ctx: CanRead):
    a = ctx.db.scalar(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.organization_id == ctx.org_id)
    )
    if a is None:
        raise NotFound()
    if a.status != AnalysisStatus.COMPLETED:
        raise AppError(409, "analysis.not_completed")
    s = get_settings()
    if s.analysis_engine == "none":
        raise AppError(503, "assistant.unavailable")
    # Each question is a model call: keep spend predictable.
    ratelimit.hit("assistant:user", str(ctx.user.id), limit=30, window_seconds=3600)

    decision = ctx.db.get(Decision, a.decision_id)
    questions = list(
        ctx.db.scalars(select(DecisionQuestion).where(DecisionQuestion.analysis_id == a.id))
    )
    job = SimpleNamespace(
        db=ctx.db, decision=decision, questions=questions, organization_id=ctx.org_id
    )
    brief = build_brief(job)
    runs = list(ctx.db.scalars(select(AgentRun).where(AgentRun.analysis_id == a.id)))
    rows = list(ctx.db.scalars(select(Finding).where(Finding.analysis_id == a.id)))
    rows.sort(key=lambda f: (_ORDER.get(f.agent, 99), f.position))
    findings = [
        DossierFinding(
            ref=i,
            agent=f.agent,
            title=f.title,
            description=f.description,
            evidence_type=f.evidence_type,
            basis=f.basis,
            likelihood=f.likelihood,
            impact=f.impact,
            mitigation=f.mitigation,
            audit_status=f.audit_status,
            audit_note=f.audit_note,
        )
        for i, f in enumerate(rows, start=1)
    ]
    dossier = Dossier(
        brief=brief,
        findings=findings,
        summaries={r.agent: r.summary for r in runs if r.summary},
        risk_score=a.risk_score,
        risk_level=a.risk_level,
        components=(a.risk_breakdown or {}).get("components", {}),
        scenarios=a.scenarios or [],
        history=[(t.role, t.content) for t in body.history],
        question=body.question,
    )
    provider = get_provider(s)
    try:
        result = provider.complete(
            LLMRequest(
                agent="assistant",
                system=system_prompt(brief.locale),
                prompt=render_dossier(dossier),
                output=AssistantAnswer,
                brief=brief,
                context=dossier,
                effort="medium",
            )
        )
    except LLMError as exc:
        raise AppError(503, "assistant.failed", code=exc.code) from exc
    out: AssistantAnswer = result.output  # type: ignore[assignment]
    by_ref = {f.ref: (f, rows[f.ref - 1]) for f in findings}
    citations = [
        Citation(
            ref=ref,
            agent=by_ref[ref][0].agent,
            title=by_ref[ref][0].title,
            severity=by_ref[ref][0].likelihood * by_ref[ref][0].impact,
            finding_id=by_ref[ref][1].id,
        )
        for ref in dict.fromkeys(out.citations)
        if ref in by_ref
    ]
    return AskOut(
        answer=out.answer.strip(),
        citations=citations,
        confidence=out.confidence,
        simulated=provider.simulated,
        model=result.model,
    )
