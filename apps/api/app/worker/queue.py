"""Database-backed job processing for analyses.

Claiming and crash recovery use two SECURITY DEFINER functions (see migration 0005); every
other read and write happens in the tenant's RLS context.
"""

import logging
import time
import uuid
from datetime import timedelta

from sqlalchemy import select, text

from app.core.config import get_settings
from app.db.base import utcnow
from app.db.session import new_session, set_rls_context
from app.models import Analysis, AnalysisStatus, Decision, DecisionQuestion
from app.worker.pipeline import (
    AnalysisPipeline,
    AnalysisTimeout,
    EngineUnavailable,
    JobContext,
)

log = logging.getLogger(__name__)

ENGINE_WAIT = timedelta(minutes=5)


def backoff(attempt: int) -> timedelta:
    return timedelta(seconds=min(30 * 2 ** max(attempt - 1, 0), 1800))


def recover_stale(timeout_seconds: int) -> int:
    with new_session() as s:
        n = s.execute(
            text("SELECT recover_stale_analyses(:t)"), {"t": timeout_seconds}
        ).scalar_one()
        s.commit()
    if n:
        log.warning("recovered stale analyses", extra={"count": n})
    return int(n)


def claim(worker_id: str) -> tuple[uuid.UUID, uuid.UUID] | None:
    with new_session() as s:
        row = s.execute(text("SELECT * FROM claim_next_analysis(:w)"), {"w": worker_id}).first()
        s.commit()
    return (row[0], row[1]) if row else None


def process_one(pipeline: AnalysisPipeline, worker_id: str) -> str:
    """Claim and process one job. Returns: idle, completed, waiting, retry, failed, canceled."""
    claimed = claim(worker_id)
    if claimed is None:
        return "idle"
    analysis_id, org_id = claimed
    settings = get_settings()

    with new_session() as db:
        set_rls_context(db, org_id=org_id)
        a = db.get(Analysis, analysis_id)
        if a is None:  # deleted meanwhile
            return "canceled"
        decision = db.get(Decision, a.decision_id)
        questions = list(
            db.scalars(select(DecisionQuestion).where(DecisionQuestion.analysis_id == a.id))
        )

        def progress(stage: AnalysisStatus) -> None:
            db.refresh(a)
            if a.status == AnalysisStatus.CANCELED:
                raise _Canceled()
            a.status = stage
            a.heartbeat_at = utcnow()
            db.commit()

        job = JobContext(
            db=db,
            analysis=a,
            decision=decision,
            questions=questions,
            deadline=time.monotonic() + settings.analysis_timeout_seconds,
            _progress=progress,
        )
        try:
            pipeline.run(job)
            outcome = _finish(db, a, AnalysisStatus.COMPLETED)
        except _Canceled:
            db.rollback()
            outcome = "canceled"
        except EngineUnavailable:
            db.rollback()
            db.refresh(a)
            if a.status == AnalysisStatus.CANCELED:
                return "canceled"
            a.status = AnalysisStatus.PENDING
            a.attempts = max(a.attempts - 1, 0)  # waiting for the engine is not a failed try
            a.waiting_reason = "engine_unavailable"
            a.next_attempt_at = utcnow() + ENGINE_WAIT
            a.locked_by = None
            db.commit()
            outcome = "waiting"
        except Exception as exc:  # noqa: BLE001 - every failure must end in a known state
            db.rollback()
            db.refresh(a)
            if a.status == AnalysisStatus.CANCELED:
                return "canceled"
            if isinstance(exc, AnalysisTimeout):
                code = "timeout"
            else:
                code = getattr(exc, "error_code", None) or "pipeline_error"
            log.exception("analysis failed", extra={"analysis_id": str(a.id), "code": code})
            a.error_code = code
            a.error_message = type(exc).__name__  # never leak tenant data into logs/messages
            a.locked_by = None
            # A non-retryable failure (bad credentials, refusal) fails at once.
            if a.attempts >= a.max_attempts or getattr(exc, "retryable", True) is False:
                outcome = _finish(db, a, AnalysisStatus.FAILED)
            else:
                a.status = AnalysisStatus.PENDING
                a.next_attempt_at = utcnow() + backoff(a.attempts)
                db.commit()
                outcome = "retry"
        return outcome


class _Canceled(Exception):  # noqa: N818
    pass


def _finish(db, a: Analysis, final: AnalysisStatus) -> str:  # type: ignore[no-untyped-def]
    db.refresh(a)
    if a.status == AnalysisStatus.CANCELED:
        return "canceled"
    a.status = final
    a.finished_at = utcnow()
    a.locked_by = None
    db.commit()
    return final.value
