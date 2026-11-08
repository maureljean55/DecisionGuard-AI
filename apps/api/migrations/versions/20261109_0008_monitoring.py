"""Monitoring: periodic re-analysis per decision and mitigation actions.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("decisions", sa.Column("monitor_every_days", sa.SmallInteger()))
    op.create_check_constraint(
        "ck_decisions_monitor_every",
        "decisions",
        "monitor_every_days IS NULL OR monitor_every_days IN (30, 90)",
    )

    op.create_table(
        "mitigation_actions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "decision_id",
            sa.Uuid(),
            sa.ForeignKey("decisions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("finding_id", sa.Uuid(), sa.ForeignKey("findings.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("due_date", sa.Date()),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True)),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('todo','in_progress','done')", name="ck_mitigation_actions_status"
        ),
    )
    op.execute("""
        ALTER TABLE mitigation_actions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY mitigation_actions_org ON mitigation_actions FOR ALL
            USING (organization_id = app_current_org_id())
            WITH CHECK (organization_id = app_current_org_id());
        GRANT SELECT, INSERT, UPDATE, DELETE ON mitigation_actions TO dg_app;
    """)

    # Decisions whose monitoring is due. Returns ids only; the re-analysis itself runs in
    # the tenant's RLS context.
    op.execute("""
        CREATE FUNCTION due_monitored_decisions(max_rows integer)
        RETURNS TABLE (decision_id uuid, organization_id uuid)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
          SELECT d.id, d.organization_id
            FROM decisions d
           WHERE d.monitor_every_days IS NOT NULL
             AND d.status = 'submitted'
             AND NOT EXISTS (
                   SELECT 1 FROM analyses a
                    WHERE a.decision_id = d.id
                      AND a.status IN ('collecting_info','pending','analyzing',
                                       'simulating','verifying','reporting'))
             AND coalesce((SELECT max(a.created_at) FROM analyses a
                            WHERE a.decision_id = d.id AND a.status <> 'canceled'),
                          'epoch'::timestamptz)
                 < now() - make_interval(days => d.monitor_every_days)
           ORDER BY d.organization_id
           LIMIT max_rows;
        $$;
        REVOKE ALL ON FUNCTION due_monitored_decisions(integer) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION due_monitored_decisions(integer) TO dg_app;
    """)
    op.execute("""
        DO $$
        DECLARE r text;
        BEGIN
          FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
              EXECUTE format('REVOKE ALL ON mitigation_actions FROM %I', r);
              EXECUTE format(
                'REVOKE ALL ON FUNCTION due_monitored_decisions(integer) FROM %I', r);
            END IF;
          END LOOP;
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS due_monitored_decisions(integer)")
    op.drop_table("mitigation_actions")
    op.drop_constraint("ck_decisions_monitor_every", "decisions")
    op.drop_column("decisions", "monitor_every_days")
