"""Agent runs, findings, and engine provenance on analyses.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EVIDENCE = "('fact','assumption','estimate','ai_hypothesis')"


def _org() -> sa.Column:
    return sa.Column(
        "organization_id",
        sa.Uuid(),
        sa.ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )


def _analysis() -> sa.Column:
    return sa.Column(
        "analysis_id",
        sa.Uuid(),
        sa.ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


def upgrade() -> None:
    op.add_column("analyses", sa.Column("provider", sa.String(32)))
    op.add_column("analyses", sa.Column("model", sa.String(64)))
    op.add_column(
        "analyses",
        sa.Column("simulated", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        _analysis(),
        sa.Column("agent", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model", sa.String(64)),
        sa.Column("summary", sa.Text()),
        sa.Column("confidence", sa.String(8)),
        sa.Column("missing_information", JSONB(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('completed','failed')", name="ck_agent_runs_status"),
        sa.CheckConstraint(
            "confidence IS NULL OR confidence IN ('low','medium','high')",
            name="ck_agent_runs_confidence",
        ),
    )

    op.create_table(
        "findings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        _analysis(),
        sa.Column(
            "agent_run_id",
            sa.Uuid(),
            sa.ForeignKey("agent_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("agent", sa.String(32), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence_type", sa.String(16), nullable=False),
        sa.Column("basis", sa.Text(), nullable=False),
        sa.Column("likelihood", sa.SmallInteger(), nullable=False),
        sa.Column("impact", sa.SmallInteger(), nullable=False),
        sa.Column("mitigation", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(f"evidence_type IN {EVIDENCE}", name="ck_findings_evidence"),
        sa.CheckConstraint(
            "likelihood BETWEEN 1 AND 5 AND impact BETWEEN 1 AND 5", name="ck_findings_scale"
        ),
    )

    for table in ("agent_runs", "findings"):
        op.execute(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            CREATE POLICY {table}_org ON {table} FOR ALL
                USING (organization_id = app_current_org_id())
                WITH CHECK (organization_id = app_current_org_id());
            GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO dg_app;
        """)  # noqa: S608 - constant table names

    op.execute("""
        DO $$
        DECLARE r text;
        BEGIN
          FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
              EXECUTE format('REVOKE ALL ON agent_runs, findings FROM %I', r);
            END IF;
          END LOOP;
        END $$;
    """)


def downgrade() -> None:
    op.drop_table("findings")
    op.drop_table("agent_runs")
    op.drop_column("analyses", "simulated")
    op.drop_column("analyses", "model")
    op.drop_column("analyses", "provider")
