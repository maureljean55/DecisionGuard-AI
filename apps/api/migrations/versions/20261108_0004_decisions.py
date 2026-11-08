"""Decisions (tenant data) with Row-Level Security.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = (
    "strategic",
    "financial",
    "operational",
    "technological",
    "organizational",
    "commercial",
    "legal",
)
STATUSES = ("draft", "submitted", "archived")


def upgrade() -> None:
    op.create_table(
        "decisions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("context", sa.Text()),
        sa.Column(
            "category",
            sa.Enum(
                *CATEGORIES,
                name="decision_category",
                native_enum=False,
                length=32,
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                *STATUSES,
                name="decision_status",
                native_enum=False,
                length=16,
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(18, 2)),
        sa.Column("currency", sa.String(3)),
        sa.Column("deadline", sa.Date()),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(f"category IN {CATEGORIES}", name="ck_decisions_category"),
        sa.CheckConstraint(f"status IN {STATUSES}", name="ck_decisions_status"),
        sa.CheckConstraint("amount IS NULL OR amount >= 0", name="ck_decisions_amount"),
        sa.CheckConstraint(
            "currency IS NULL OR currency ~ '^[A-Z]{3}$'", name="ck_decisions_currency"
        ),
    )
    op.create_index("ix_decisions_org_updated", "decisions", ["organization_id", "updated_at"])
    op.execute("""
        ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY decisions_org ON decisions FOR ALL
            USING (organization_id = app_current_org_id())
            WITH CHECK (organization_id = app_current_org_id());
        GRANT SELECT, INSERT, UPDATE, DELETE ON decisions TO dg_app;
    """)
    op.execute("""
        DO $$
        DECLARE r text;
        BEGIN
          FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
              EXECUTE format('REVOKE ALL ON decisions FROM %I', r);
            END IF;
          END LOOP;
        END $$;
    """)


def downgrade() -> None:
    op.drop_table("decisions")
