"""Compute the risk index for analyses completed before M6: `python -m app.risk.backfill`.

Runs with the migration (owner) connection, across organisations. Findings stay unaudited;
only the deterministic score and scenarios are added. Idempotent.
"""

import os

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AgentRun, Analysis, AnalysisStatus, DecisionQuestion, Finding
from app.risk import engine as risk


def main() -> None:
    s = get_settings()
    eng = create_engine(os.environ.get("DG_MIGRATION_DATABASE_URL") or s.migration_database_url)
    done = 0
    with Session(eng) as db:
        todo = db.scalars(
            select(Analysis).where(
                Analysis.status == AnalysisStatus.COMPLETED, Analysis.risk_score.is_(None)
            )
        ).all()
        for a in todo:
            findings = db.scalars(select(Finding).where(Finding.analysis_id == a.id)).all()
            runs = db.scalars(select(AgentRun).where(AgentRun.analysis_id == a.id)).all()
            unknown = db.scalars(
                select(DecisionQuestion).where(
                    DecisionQuestion.analysis_id == a.id, DecisionQuestion.unknown.is_(True)
                )
            ).all()
            counted = [
                risk.Item(f.agent, f.likelihood, f.impact)
                for f in findings
                if f.audit_status != "unsupported"
            ]
            inputs = risk.Inputs(
                unknown_answers=len(unknown),
                failed_agents=sum(1 for r in runs if r.status == "failed" and r.agent != "audit"),
                missing_items=sum(len(r.missing_information or []) for r in runs),
            )
            excluded = len(findings) - len(counted)
            r = risk.compute(counted, inputs, excluded)
            a.risk_score, a.risk_level, a.risk_model = r.score, r.level, r.model
            a.risk_breakdown = r.as_dict()
            a.scenarios = risk.scenarios(counted, inputs, excluded)
            done += 1
        db.commit()
    print(f"backfilled {done} analyses")


if __name__ == "__main__":
    main()
