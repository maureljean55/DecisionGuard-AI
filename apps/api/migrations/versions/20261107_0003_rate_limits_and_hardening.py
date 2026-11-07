"""Rate-limit table, and hardening for hosted Postgres (Supabase).

- `rate_limits`: fixed-window counters (replaces Redis for rate limiting).
- Every table gets Row-Level Security. Identity tables (users, sessions, tokens) and
  rate_limits are reachable by the runtime role `dg_app` only.
- On Supabase, the `anon` / `authenticated` roles are used by the auto-generated public
  Data API. They must never reach our tables: all privileges are revoked, including on
  future tables. (No-op on plain Postgres, where those roles do not exist.)

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

IDENTITY_TABLES = ("users", "auth_sessions", "user_tokens", "rate_limits")


def upgrade() -> None:
    op.create_table(
        "rate_limits",
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO dg_app")

    for table in IDENTITY_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_runtime ON {table} TO dg_app USING (true) WITH CHECK (true)"
        )

    op.execute("""
        DO $$
        DECLARE r text;
        BEGIN
          FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
              EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
              EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
              EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
              EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
              EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
              EXECUTE format(
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
            END IF;
          END LOOP;
        END $$;
    """)


def downgrade() -> None:
    for table in IDENTITY_TABLES[:-1]:
        op.execute(f"DROP POLICY IF EXISTS {table}_runtime ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.drop_table("rate_limits")
