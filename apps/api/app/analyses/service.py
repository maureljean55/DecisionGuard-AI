"""Analysis lifecycle: request (with quota and pre-check), answers, cancellation."""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analyses.precheck import missing_information
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.plans import monthly_limit
from app.db.base import utcnow
from app.models import (
    ACTIVE,
    Analysis,
    AnalysisStatus,
    Decision,
    DecisionQuestion,
    DecisionStatus,
    Organization,
)
from app.orgs.deps import OrgContext


@dataclass
class SystemContext:
    """Tenant context for work started by DecisionGuard itself (scheduled re-analysis)."""

    db: Session
    org: Organization
    user: None = None

    @property
    def org_id(self) -> uuid.UUID:
        return self.org.id


def mark_queued(a: Analysis) -> None:
    """Queue an analysis. Without an engine, say so up front instead of promising a start."""
    a.status = AnalysisStatus.PENDING
    a.waiting_reason = "engine_unavailable" if get_settings().analysis_engine == "none" else None


def period_start(now: datetime | None = None) -> date:
    now = now or datetime.now(UTC)
    return date(now.year, now.month, 1)


def usage(ctx: OrgContext | SystemContext) -> tuple[int, int | None]:
    used = ctx.db.scalar(
        select(func.count())
        .select_from(Analysis)
        .where(
            Analysis.organization_id == ctx.org_id,
            Analysis.quota_period == period_start(),
            Analysis.status != AnalysisStatus.CANCELED,
        )
    )
    return int(used or 0), monthly_limit(ctx.org.plan)


def active_analysis(ctx: OrgContext | SystemContext, decision_id: uuid.UUID) -> Analysis | None:
    return ctx.db.scalar(
        select(Analysis).where(Analysis.decision_id == decision_id, Analysis.status.in_(ACTIVE))
    )


def _previous_answers(ctx: OrgContext | SystemContext, decision_id: uuid.UUID) -> dict:
    """Latest answer given to each pre-check question for this decision."""
    rows = ctx.db.execute(
        select(DecisionQuestion)
        .join(Analysis, Analysis.id == DecisionQuestion.analysis_id)
        .where(
            DecisionQuestion.decision_id == decision_id,
            DecisionQuestion.answered_at.is_not(None),
        )
        .order_by(Analysis.created_at.desc())
    ).scalars()
    out: dict[str, DecisionQuestion] = {}
    for q in rows:
        out.setdefault(q.key, q)
    return out


def request_analysis(ctx: OrgContext | SystemContext, d: Decision) -> Analysis:
    """Submit a decision: quota check, pre-check questions, queue. Caller commits.

    Answers given in an earlier analysis of the same decision are carried over, so a
    re-analysis does not ask the same questions again.
    """
    existing = active_analysis(ctx, d.id)
    if existing:
        return existing
    used, limit = usage(ctx)
    if limit is not None and used >= limit:
        raise AppError(status.HTTP_402_PAYMENT_REQUIRED, "quota.exceeded", limit=limit)

    keys = missing_information(d)
    previous = _previous_answers(ctx, d.id)
    a = Analysis(
        id=uuid.uuid4(),
        organization_id=ctx.org_id,
        decision_id=d.id,
        requested_by_user_id=ctx.user.id if ctx.user else None,
        status=AnalysisStatus.COLLECTING_INFO,
        attempts=0,
        max_attempts=3,
        quota_period=period_start(),
    )
    ctx.db.add(a)
    ctx.db.flush()
    open_questions = 0
    for i, key in enumerate(keys):
        prev = previous.get(key)
        q = DecisionQuestion(
            organization_id=ctx.org_id,
            decision_id=d.id,
            analysis_id=a.id,
            key=key,
            position=i,
            unknown=False,
        )
        if prev is not None:
            q.answer, q.unknown = prev.answer, prev.unknown
            q.answered_by_user_id, q.answered_at = prev.answered_by_user_id, utcnow()
        else:
            open_questions += 1
        ctx.db.add(q)
    if open_questions == 0:
        mark_queued(a)
    d.status = DecisionStatus.SUBMITTED
    d.submitted_at = utcnow()
    return a


def cancel_active(ctx: OrgContext, d: Decision) -> bool:
    a = active_analysis(ctx, d.id)
    if a is None:
        return False
    a.status = AnalysisStatus.CANCELED
    a.finished_at = utcnow()
    a.locked_by = None
    return True


def questions_for(ctx: OrgContext, analysis_id: uuid.UUID) -> list[DecisionQuestion]:
    return list(
        ctx.db.scalars(
            select(DecisionQuestion)
            .where(DecisionQuestion.analysis_id == analysis_id)
            .order_by(DecisionQuestion.position)
        )
    )


def release_if_complete(ctx: OrgContext, a: Analysis) -> None:
    """Once every question is answered (or marked unknown), queue the analysis."""
    if a.status != AnalysisStatus.COLLECTING_INFO:
        return
    open_q = [q for q in questions_for(ctx, a.id) if q.answered_at is None]
    if not open_q:
        mark_queued(a)
