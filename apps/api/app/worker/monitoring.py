"""Scheduled re-analysis of monitored decisions (30 or 90 days).

`due_monitored_decisions` (SECURITY DEFINER, migration 0008) returns ids only; each
re-analysis is then requested inside the tenant's RLS context, with the usual quota check.
"""

import logging

from sqlalchemy import text

from app.analyses.service import SystemContext, request_analysis
from app.core.errors import AppError
from app.db.session import new_session, set_rls_context
from app.models import Decision, Organization

log = logging.getLogger(__name__)


def schedule_due(max_rows: int = 20) -> int:
    """Queue a re-analysis for every monitored decision that is due. Returns how many."""
    with new_session() as s:
        due = s.execute(text("SELECT * FROM due_monitored_decisions(:n)"), {"n": max_rows}).all()
        s.commit()
    queued = 0
    for decision_id, org_id in due:
        with new_session() as db:
            set_rls_context(db, org_id=org_id)
            org = db.get(Organization, org_id)
            d = db.get(Decision, decision_id)
            if org is None or d is None:
                continue
            try:
                request_analysis(SystemContext(db=db, org=org), d)
            except AppError as exc:  # quota reached: try again on a later run
                log.info("monitoring skipped", extra={"decision": str(d.id), "code": exc.code})
                db.rollback()
                continue
            db.commit()
            queued += 1
    if queued:
        log.info("monitoring queued", extra={"count": queued})
    return queued
