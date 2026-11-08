"""Analyses: queue state, follow-up questions, retries and monthly usage."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import distinct_on

from app.agents.specs import AGENTS
from app.analyses import service
from app.analyses.schemas import (
    AgentRunOut,
    AnalysisOut,
    AnswerIn,
    EngineOut,
    FindingOut,
    OrgFindingOut,
    QuestionOut,
    UsageOut,
)
from app.auth.deps import CurrentUser
from app.core import audit
from app.core.config import get_settings
from app.core.errors import AppError, NotFound
from app.core.permissions import Permission
from app.db.base import utcnow
from app.models import (
    AgentRun,
    Analysis,
    AnalysisStatus,
    Decision,
    DecisionQuestion,
    DecisionStatus,
    Finding,
)
from app.orgs.deps import Member, OrgContext, require
from app.risk import engine as risk

router = APIRouter(tags=["analyses"])

CanRead = Annotated[OrgContext, Depends(require(Permission.DECISIONS_READ))]
CanWrite = Annotated[OrgContext, Depends(require(Permission.DECISIONS_WRITE))]


def _meta(request: Request) -> audit.RequestMeta:
    return audit.RequestMeta.from_request(request)


def _get(ctx: OrgContext, analysis_id: uuid.UUID) -> Analysis:
    a = ctx.db.scalar(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.organization_id == ctx.org_id)
    )
    if a is None:
        raise NotFound()
    return a


def _out(ctx: OrgContext, a: Analysis, with_questions: bool = True) -> AnalysisOut:
    qs = service.questions_for(ctx, a.id) if with_questions else []
    title = ctx.db.scalar(select(Decision.title).where(Decision.id == a.decision_id))
    out = AnalysisOut.model_validate(a)
    out.decision_title = title
    out.questions = [QuestionOut.model_validate(q) for q in qs]
    out.open_questions = sum(1 for q in qs if q.answered_at is None)
    if with_questions:
        out.agents = _agents(ctx, a.id)
    return out


_AGENT_ORDER = {spec.key: i for i, spec in enumerate(AGENTS)}


def _agents(ctx: OrgContext, analysis_id: uuid.UUID) -> list[AgentRunOut]:
    runs = list(ctx.db.scalars(select(AgentRun).where(AgentRun.analysis_id == analysis_id)))
    findings = ctx.db.scalars(
        select(Finding).where(Finding.analysis_id == analysis_id).order_by(Finding.position)
    )
    by_run: dict[uuid.UUID, list[FindingOut]] = {}
    for f in findings:
        by_run.setdefault(f.agent_run_id, []).append(FindingOut.model_validate(f))
    out = []
    for r in sorted(runs, key=lambda r: _AGENT_ORDER.get(r.agent, 99)):
        item = AgentRunOut.model_validate(r)
        item.findings = by_run.get(r.id, [])
        out.append(item)
    return out


@router.get("/orgs/{org_id}/usage", response_model=UsageOut)
def get_usage(ctx: Member):
    used, limit = service.usage(ctx)
    return UsageOut(plan=ctx.org.plan, period_start=service.period_start(), used=used, limit=limit)


@router.get("/orgs/{org_id}/analyses", response_model=list[AnalysisOut])
def list_analyses(ctx: CanRead):
    rows = ctx.db.scalars(
        select(Analysis)
        .where(Analysis.organization_id == ctx.org_id)
        .order_by(Analysis.created_at.desc())
        .limit(100)
    ).all()
    return [_out(ctx, a, with_questions=False) for a in rows]


@router.get("/orgs/{org_id}/analyses/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: uuid.UUID, ctx: CanRead):
    return _out(ctx, _get(ctx, analysis_id))


@router.get("/orgs/{org_id}/decisions/{decision_id}/analyses", response_model=list[AnalysisOut])
def decision_analyses(decision_id: uuid.UUID, ctx: CanRead):
    rows = ctx.db.scalars(
        select(Analysis)
        .where(Analysis.organization_id == ctx.org_id, Analysis.decision_id == decision_id)
        .order_by(Analysis.created_at.desc())
    ).all()
    return [_out(ctx, a) for a in rows]


@router.put(
    "/orgs/{org_id}/analyses/{analysis_id}/questions/{question_id}", response_model=AnalysisOut
)
def answer_question(
    analysis_id: uuid.UUID, question_id: uuid.UUID, body: AnswerIn, ctx: CanWrite, request: Request
):
    a = _get(ctx, analysis_id)
    if a.status != AnalysisStatus.COLLECTING_INFO:
        raise AppError(status.HTTP_409_CONFLICT, "analysis.not_collecting")
    q = ctx.db.scalar(
        select(DecisionQuestion).where(
            DecisionQuestion.id == question_id, DecisionQuestion.analysis_id == a.id
        )
    )
    if q is None:
        raise NotFound()
    q.unknown = body.unknown
    q.answer = None if body.unknown else (body.answer or "").strip()
    q.answered_by_user_id = ctx.user.id
    q.answered_at = utcnow()
    ctx.db.flush()
    service.release_if_complete(ctx, a)
    audit.record(
        ctx.db,
        "analysis.answer",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="analysis",
        target_id=a.id,
        details={"question": q.key, "unknown": q.unknown},
    )
    ctx.db.commit()
    return _out(ctx, a)


@router.post("/orgs/{org_id}/analyses/{analysis_id}/retry", response_model=AnalysisOut)
def retry_analysis(analysis_id: uuid.UUID, ctx: CanWrite, request: Request):
    """Retry a failed analysis. Does not consume quota again."""
    a = _get(ctx, analysis_id)
    if a.status != AnalysisStatus.FAILED:
        raise AppError(status.HTTP_409_CONFLICT, "analysis.not_retryable")
    service.mark_queued(a)
    a.attempts = 0
    a.error_code = a.error_message = None
    a.finished_at = None
    a.next_attempt_at = None
    audit.record(
        ctx.db,
        "analysis.retry",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="analysis",
        target_id=a.id,
    )
    ctx.db.commit()
    return _out(ctx, a)


# Every agent of the roadmap runs since M7. Kept for future additions.
PLANNED_AGENTS: list[str] = []


@router.get("/engine", response_model=EngineOut)
def engine_status(_: CurrentUser):
    s = get_settings()
    if s.analysis_engine == "none":
        status_ = "unavailable"
    elif s.llm_provider == "mock":
        status_ = "simulated"
    else:
        status_ = "active"
    active = [a.key for a in AGENTS] + ["audit", "scenarios"] if status_ != "unavailable" else []
    return EngineOut(status=status_, agents_active=active, agents_planned=PLANNED_AGENTS)


@router.get("/orgs/{org_id}/findings", response_model=list[OrgFindingOut])
def org_findings(ctx: CanRead):
    """Findings of the latest completed analysis of each non-archived decision."""
    latest = (
        select(Analysis.id)
        .join(Decision, Decision.id == Analysis.decision_id)
        .where(
            Analysis.organization_id == ctx.org_id,
            Analysis.status == AnalysisStatus.COMPLETED,
            Decision.status != DecisionStatus.ARCHIVED,
        )
        .ext(distinct_on(Analysis.decision_id))
        .order_by(Analysis.decision_id, Analysis.finished_at.desc())
    )
    rows = ctx.db.execute(
        select(Finding, Decision.id, Decision.title, Analysis.simulated)
        .join(Analysis, Analysis.id == Finding.analysis_id)
        .join(Decision, Decision.id == Analysis.decision_id)
        .where(Finding.analysis_id.in_(latest))
        .order_by((Finding.likelihood * Finding.impact).desc(), Finding.created_at.desc())
        .limit(500)
    ).all()
    out = []
    for f, decision_id, title, simulated in rows:
        item = OrgFindingOut.model_validate(
            {
                **FindingOut.model_validate(f).model_dump(),
                "agent": f.agent,
                "decision_id": decision_id,
                "decision_title": title,
                "analysis_id": f.analysis_id,
                "simulated": simulated,
                "created_at": f.created_at,
            }
        )
        out.append(item)
    return out


class Shift(BaseModel):
    likelihood: int = Field(default=0, ge=-2, le=2)
    impact: int = Field(default=0, ge=-2, le=2)


class SimulateIn(BaseModel):
    """Offsets applied to the agents' estimates. `all` applies to every agent first."""

    all: Shift = Shift()
    agents: dict[str, Shift] = Field(default_factory=dict, max_length=20)


@router.post("/orgs/{org_id}/analyses/{analysis_id}/simulate")
def simulate(analysis_id: uuid.UUID, body: SimulateIn, ctx: CanRead) -> dict:
    """Recompute the risk index under adjusted assumptions. Read-only: nothing is stored."""
    a = _get(ctx, analysis_id)
    if a.status != AnalysisStatus.COMPLETED or a.risk_breakdown is None:
        raise AppError(409, "analysis.not_completed")
    rows = ctx.db.scalars(select(Finding).where(Finding.analysis_id == a.id))
    counted, excluded = [], 0
    for f in rows:
        if f.audit_status == "unsupported":
            excluded += 1
            continue
        counted.append(risk.Item(f.agent, f.likelihood, f.impact))
    shifts = {
        agent: (body.all.likelihood + sh.likelihood, body.all.impact + sh.impact)
        for agent, sh in body.agents.items()
    }
    moved = risk.shift(counted, shifts, default=(body.all.likelihood, body.all.impact))
    inputs = risk.Inputs(**a.risk_breakdown.get("inputs", {}))
    result = risk.compute(moved, inputs, excluded)
    return {**result.as_dict(), "baseline": a.risk_score}


@router.get("/orgs/{org_id}/analyses/{analysis_id}/report.pdf")
def report_pdf(analysis_id: uuid.UUID, ctx: CanRead) -> Response:
    """PDF report of a completed analysis, built from stored data only."""
    from app.reports.pdf import ReportData, render

    a = _get(ctx, analysis_id)
    if a.status != AnalysisStatus.COMPLETED or a.risk_score is None:
        raise AppError(409, "analysis.not_completed")
    d = ctx.db.get(Decision, a.decision_id)
    if d is None:
        raise NotFound()
    amount = None
    if d.amount is not None:
        amount = f"{d.amount:,.0f}".replace(",", "\u00a0") + (
            f" {d.currency}" if d.currency else ""
        )
    data = ReportData(
        locale=ctx.org.default_locale,
        org_name=ctx.org.name,
        title=d.title,
        description=d.description,
        category=str(getattr(d.category, "value", d.category)),
        amount=amount,
        deadline=d.deadline.strftime("%d/%m/%Y") if d.deadline else None,
        finished_at=a.finished_at,
        provider=a.provider,
        model=a.model,
        simulated=a.simulated,
        risk_score=a.risk_score,
        risk_level=a.risk_level or "low",
        breakdown=a.risk_breakdown or {},
        scenarios=a.scenarios or [],
        runs=[r.model_dump(mode="json") for r in _agents(ctx, a.id)],
    )
    slug = "".join(c if c.isalnum() else "-" for c in d.title.lower())[:50].strip("-")
    slug = slug.encode("ascii", "ignore").decode() or "decision"
    return Response(
        content=render(data),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="decisionguard-{slug}.pdf"',
            "Cache-Control": "private, no-store",
        },
    )
