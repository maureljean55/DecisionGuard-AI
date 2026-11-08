"""Analysis jobs (database-backed queue) and pre-analysis follow-up questions.

The worker connects as the unprivileged runtime role. It cannot see other tenants' rows, so
claiming and crash recovery go through two narrow SECURITY DEFINER functions that only touch
queue columns and return (id, organization_id); all further work happens inside the tenant's
RLS context.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = (
    "collecting_info",
    "pending",
    "analyzing",
    "simulating",
    "verifying",
    "reporting",
    "completed",
    "failed",
    "canceled",
)
ACTIVE = "('collecting_info','pending','analyzing','simulating','verifying','reporting')"
RUNNING = "('analyzing','simulating','verifying','reporting')"


def _ts(name: str, nullable: bool = True) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def upgrade() -> None:
    op.create_table(
        "analyses",
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
        ),
        sa.Column(
            "requested_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column(
            "status",
            sa.Enum(
                *STATUSES,
                name="analysis_status",
                native_enum=False,
                length=24,
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        _ts("next_attempt_at"),
        _ts("heartbeat_at"),
        sa.Column("locked_by", sa.String(64)),
        sa.Column("waiting_reason", sa.String(64)),
        sa.Column("error_code", sa.String(64)),
        sa.Column("error_message", sa.Text()),
        sa.Column("quota_period", sa.Date(), nullable=False),
        _ts("started_at"),
        _ts("finished_at"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(f"status IN {STATUSES}", name="ck_analyses_status"),
        sa.CheckConstraint("attempts >= 0 AND max_attempts >= 1", name="ck_analyses_attempts"),
    )
    op.create_index("ix_analyses_org_created", "analyses", ["organization_id", "created_at"])
    op.create_index("ix_analyses_queue", "analyses", ["status", "next_attempt_at"])
    op.create_index(
        "uq_analyses_active_decision",
        "analyses",
        ["decision_id"],
        unique=True,
        postgresql_where=sa.text(f"status IN {ACTIVE}"),
    )

    op.create_table(
        "decision_questions",
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
        sa.Column(
            "analysis_id",
            sa.Uuid(),
            sa.ForeignKey("analyses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(32), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("answer", sa.Text()),
        sa.Column("unknown", sa.Boolean(), nullable=False),
        sa.Column("answered_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        _ts("answered_at"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("analysis_id", "key"),
    )

    for table in ("analyses", "decision_questions"):
        op.execute(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            CREATE POLICY {table}_org ON {table} FOR ALL
                USING (organization_id = app_current_org_id())
                WITH CHECK (organization_id = app_current_org_id());
            GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO dg_app;
        """)  # noqa: S608 - constant table names

    op.execute(f"""
        CREATE FUNCTION claim_next_analysis(worker text)
        RETURNS TABLE (id uuid, organization_id uuid)
        LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
          UPDATE analyses a
             SET status = 'analyzing', attempts = a.attempts + 1, locked_by = worker,
                 heartbeat_at = now(), started_at = coalesce(a.started_at, now()),
                 waiting_reason = NULL, updated_at = now()
           WHERE a.id = (
                 SELECT q.id FROM analyses q
                  WHERE q.status = 'pending'
                    AND (q.next_attempt_at IS NULL OR q.next_attempt_at <= now())
                  ORDER BY q.created_at
                  FOR UPDATE SKIP LOCKED
                  LIMIT 1)
          RETURNING a.id, a.organization_id;
        $$;

        CREATE FUNCTION recover_stale_analyses(timeout_seconds integer)
        RETURNS integer
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
        DECLARE n integer;
        BEGIN
          UPDATE analyses
             SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
                 error_code = 'timeout',
                 finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END,
                 next_attempt_at = now(), locked_by = NULL, updated_at = now()
           WHERE status IN {RUNNING}
             AND heartbeat_at < now() - make_interval(secs => timeout_seconds);
          GET DIAGNOSTICS n = ROW_COUNT;
          RETURN n;
        END $$;

        REVOKE ALL ON FUNCTION claim_next_analysis(text) FROM PUBLIC;
        REVOKE ALL ON FUNCTION recover_stale_analyses(integer) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION claim_next_analysis(text) TO dg_app;
        GRANT EXECUTE ON FUNCTION recover_stale_analyses(integer) TO dg_app;
    """)  # noqa: S608 - constant lists

    op.execute("""
        DO $$
        DECLARE r text;
        BEGIN
          FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
              EXECUTE format('REVOKE ALL ON analyses, decision_questions FROM %I', r);
              EXECUTE format('REVOKE ALL ON FUNCTION claim_next_analysis(text) FROM %I', r);
              EXECUTE format('REVOKE ALL ON FUNCTION recover_stale_analyses(integer) FROM %I', r);
            END IF;
          END LOOP;
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS claim_next_analysis(text)")
    op.execute("DROP FUNCTION IF EXISTS recover_stale_analyses(integer)")
    op.drop_table("decision_questions")
    op.drop_table("analyses")
