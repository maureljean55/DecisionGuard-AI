"""Identity, tenancy and audit log, with Row-Level Security and runtime-role grants.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLES = ("owner", "admin", "analyst", "viewer")
APP_ROLE = "dg_app"


def _ts(name: str, nullable: bool = False, default: bool = True) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        nullable=nullable,
        server_default=sa.func.now() if default else None,
    )


def _role_enum(name: str) -> sa.Enum:
    return sa.Enum(*ROLES, name=name, native_enum=False, length=16, create_constraint=False)


def upgrade() -> None:
    # ---------------------------------------------------------------- identity (global)
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", pg.CITEXT(), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("locale", sa.String(5), nullable=False),
        _ts("email_verified_at", nullable=True, default=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_platform_admin", sa.Boolean(), nullable=False),
        _ts("created_at"),
        _ts("updated_at"),
        sa.CheckConstraint("locale IN ('fr', 'en')", name="ck_users_locale"),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        _ts("created_at", default=False),
        _ts("last_seen_at", default=False),
        _ts("expires_at", default=False),
        _ts("revoked_at", nullable=True, default=False),
        sa.Column("ip", pg.INET()),
        sa.Column("user_agent", sa.String(500)),
    )
    op.create_table(
        "user_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        _ts("created_at", default=False),
        _ts("expires_at", default=False),
        _ts("used_at", nullable=True, default=False),
        sa.CheckConstraint(
            "purpose IN ('verify_email', 'reset_password')", name="ck_user_tokens_purpose"
        ),
    )

    # ---------------------------------------------------------------- tenancy
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("default_locale", sa.String(5), nullable=False),
        sa.Column("plan", sa.String(32), nullable=False),
        _ts("created_at"),
        _ts("updated_at"),
        sa.CheckConstraint("country_code ~ '^[A-Z]{2}$'", name="ck_org_country"),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_org_currency"),
        sa.CheckConstraint("default_locale IN ('fr', 'en')", name="ck_org_locale"),
    )
    op.create_table(
        "memberships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("role", _role_enum("membership_role"), nullable=False),
        _ts("created_at", default=False),
        sa.UniqueConstraint("organization_id", "user_id"),
        sa.CheckConstraint(f"role IN {ROLES}", name="ck_memberships_role"),
    )
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("email", pg.CITEXT(), nullable=False),
        sa.Column("role", _role_enum("invitation_role"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("invited_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        _ts("created_at", default=False),
        _ts("expires_at", default=False),
        _ts("accepted_at", nullable=True, default=False),
        _ts("revoked_at", nullable=True, default=False),
        sa.CheckConstraint(f"role IN {ROLES}", name="ck_invitations_role"),
    )

    # ---------------------------------------------------------------- audit (append-only)
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE")
        ),
        sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_type", sa.String(64)),
        sa.Column("target_id", sa.String(64)),
        sa.Column("ip", pg.INET()),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("details", pg.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        _ts("created_at", default=False),
    )
    op.create_index("ix_audit_logs_org_created", "audit_logs", ["organization_id", "created_at"])

    # ---------------------------------------------------------------- RLS helpers
    op.execute("""
        CREATE FUNCTION app_current_user_id() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;
        CREATE FUNCTION app_current_org_id() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT NULLIF(current_setting('app.org_id', true), '')::uuid $$;
    """)

    # organizations: visible to its members (to list "my organizations") and in its own context;
    # writable only in its own context.
    op.execute("""
        ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
        CREATE POLICY org_select ON organizations FOR SELECT USING (
            id = app_current_org_id()
            OR EXISTS (SELECT 1 FROM memberships m
                       WHERE m.organization_id = organizations.id
                         AND m.user_id = app_current_user_id())
        );
        CREATE POLICY org_insert ON organizations FOR INSERT WITH CHECK (id = app_current_org_id());
        CREATE POLICY org_update ON organizations FOR UPDATE
            USING (id = app_current_org_id()) WITH CHECK (id = app_current_org_id());
        CREATE POLICY org_delete ON organizations FOR DELETE USING (id = app_current_org_id());
    """)

    # memberships: a user sees their own memberships everywhere; writes need the org context.
    op.execute("""
        ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
        CREATE POLICY mem_select ON memberships FOR SELECT USING (
            organization_id = app_current_org_id() OR user_id = app_current_user_id()
        );
        CREATE POLICY mem_insert ON memberships FOR INSERT
            WITH CHECK (organization_id = app_current_org_id());
        CREATE POLICY mem_update ON memberships FOR UPDATE
            USING (organization_id = app_current_org_id())
            WITH CHECK (organization_id = app_current_org_id());
        CREATE POLICY mem_delete ON memberships FOR DELETE
            USING (organization_id = app_current_org_id());
    """)

    # invitations: org context, or possession of the token (to preview / accept it).
    op.execute("""
        ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
        CREATE POLICY inv_org ON invitations FOR ALL
            USING (organization_id = app_current_org_id())
            WITH CHECK (organization_id = app_current_org_id());
        CREATE POLICY inv_token_select ON invitations FOR SELECT
            USING (token_hash = NULLIF(current_setting('app.invite_token_hash', true), ''));
    """)

    # audit_logs: readable in org context; insertable for the current org or tenant-less events.
    op.execute("""
        ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY audit_select ON audit_logs FOR SELECT
            USING (organization_id = app_current_org_id());
        CREATE POLICY audit_insert ON audit_logs FOR INSERT
            WITH CHECK (organization_id IS NULL OR organization_id = app_current_org_id());
    """)

    # ---------------------------------------------------------------- runtime role grants
    grants = f"""
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
            RAISE EXCEPTION 'Role {APP_ROLE} is missing: see infra/postgres/init/01-app-role.sh';
          END IF;
        END $$;
        GRANT USAGE ON SCHEMA public TO {APP_ROLE};
        GRANT SELECT, INSERT, UPDATE, DELETE
            ON users, auth_sessions, user_tokens, organizations, memberships, invitations
            TO {APP_ROLE};
        GRANT SELECT, INSERT ON audit_logs TO {APP_ROLE};
        GRANT USAGE ON SEQUENCE audit_logs_id_seq TO {APP_ROLE};
        GRANT EXECUTE ON FUNCTION app_current_user_id(), app_current_org_id() TO {APP_ROLE};
    """  # noqa: S608 - APP_ROLE is a module constant, no external input
    op.execute(grants)


def downgrade() -> None:
    # The organizations SELECT policy references memberships: drop it before the tables.
    op.execute("DROP POLICY IF EXISTS org_select ON organizations")
    for table in (
        "audit_logs",
        "invitations",
        "memberships",
        "organizations",
        "user_tokens",
        "auth_sessions",
        "users",
    ):
        op.drop_table(table)
    op.execute("DROP FUNCTION IF EXISTS app_current_org_id()")
    op.execute("DROP FUNCTION IF EXISTS app_current_user_id()")
