"""Deterministic risk score, scenarios, and audit verdicts on findings.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("risk_score", sa.SmallInteger()))
    op.add_column("analyses", sa.Column("risk_level", sa.String(16)))
    op.add_column("analyses", sa.Column("risk_model", sa.String(16)))
    op.add_column("analyses", sa.Column("risk_breakdown", JSONB()))
    op.add_column("analyses", sa.Column("scenarios", JSONB()))
    op.create_check_constraint(
        "ck_analyses_risk_score", "analyses", "risk_score IS NULL OR risk_score BETWEEN 0 AND 100"
    )
    op.add_column("findings", sa.Column("audit_status", sa.String(16)))
    op.add_column("findings", sa.Column("audit_note", sa.Text()))
    op.create_check_constraint(
        "ck_findings_audit",
        "findings",
        "audit_status IS NULL OR audit_status IN ('supported','weak','unsupported')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_findings_audit", "findings")
    op.drop_column("findings", "audit_note")
    op.drop_column("findings", "audit_status")
    op.drop_constraint("ck_analyses_risk_score", "analyses")
    for col in ("scenarios", "risk_breakdown", "risk_model", "risk_level", "risk_score"):
        op.drop_column("analyses", col)
