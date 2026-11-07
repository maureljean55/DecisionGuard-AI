"""Cross-tenant access attempts.

Two layers are tested independently:
1. The HTTP API never returns another tenant's data (404, never 403, to hide existence).
2. Row-Level Security in PostgreSQL blocks the runtime role even if application code forgot
   to filter (queries below deliberately omit any WHERE organization_id clause).
"""

import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError, ProgrammingError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import RLSContext, new_session, set_rls_context
from tests.conftest import register, token_from_last_email


@pytest.fixture
def two_tenants(make_client):
    a, b = make_client(), make_client()
    me_a = register(a, "alice@alpha.example.com", org_name="Alpha")
    me_b = register(b, "bruno@beta.example.com", org_name="Beta")
    org_a = me_a["memberships"][0]["organization"]["id"]
    org_b = me_b["memberships"][0]["organization"]["id"]
    # Give Beta some invitations and audit entries to try to read.
    b.post(f"/orgs/{org_b}/invitations", json={"email": "secret@beta.example.com"})
    return {
        "a": a,
        "b": b,
        "org_a": org_a,
        "org_b": org_b,
        "user_a": me_a["user"]["id"],
        "user_b": me_b["user"]["id"],
    }


# ------------------------------------------------------------------ API layer


def test_api_hides_other_tenant(two_tenants) -> None:
    a, org_b = two_tenants["a"], two_tenants["org_b"]
    members_b = two_tenants["b"].get(f"/orgs/{org_b}/members").json()
    invs_b = two_tenants["b"].get(f"/orgs/{org_b}/invitations").json()

    attempts = [
        ("get", f"/orgs/{org_b}", None),
        ("patch", f"/orgs/{org_b}", {"name": "pwned"}),
        ("get", f"/orgs/{org_b}/members", None),
        ("patch", f"/orgs/{org_b}/members/{members_b[0]['id']}", {"role": "viewer"}),
        ("delete", f"/orgs/{org_b}/members/{members_b[0]['id']}", None),
        ("get", f"/orgs/{org_b}/invitations", None),
        ("post", f"/orgs/{org_b}/invitations", {"email": "spy@alpha.example.com"}),
        ("delete", f"/orgs/{org_b}/invitations/{invs_b[0]['id']}", None),
        ("get", f"/orgs/{org_b}/audit-logs", None),
        ("get", f"/orgs/{uuid.uuid4()}", None),  # non-existent: same answer
    ]
    for method, path, body in attempts:
        r = getattr(a, method)(path, **({"json": body} if body else {}))
        assert r.status_code == 404, (method, path, r.status_code, r.text)
        assert r.json()["error"]["code"] == "not_found"

    # Beta is untouched.
    assert two_tenants["b"].get(f"/orgs/{org_b}").json()["name"] == "Beta"
    assert len(two_tenants["b"].get(f"/orgs/{org_b}/members").json()) == 1


def test_member_ids_from_other_tenant_rejected_via_own_org_path(two_tenants) -> None:
    """Using my org in the URL but another tenant's membership id must not work."""
    a, org_a, org_b = two_tenants["a"], two_tenants["org_a"], two_tenants["org_b"]
    victim_mid = two_tenants["b"].get(f"/orgs/{org_b}/members").json()[0]["id"]
    assert (
        a.patch(f"/orgs/{org_a}/members/{victim_mid}", json={"role": "viewer"}).status_code == 404
    )
    assert a.delete(f"/orgs/{org_a}/members/{victim_mid}").status_code == 404


def test_invitation_ids_from_other_tenant_rejected(two_tenants) -> None:
    a, org_a, org_b = two_tenants["a"], two_tenants["org_a"], two_tenants["org_b"]
    inv_b = two_tenants["b"].get(f"/orgs/{org_b}/invitations").json()[0]["id"]
    assert a.delete(f"/orgs/{org_a}/invitations/{inv_b}").status_code == 404


def test_me_lists_only_own_memberships(two_tenants) -> None:
    orgs = [m["organization"]["id"] for m in two_tenants["a"].get("/auth/me").json()["memberships"]]
    assert orgs == [two_tenants["org_a"]]


# ------------------------------------------------------------------ database layer (RLS)


def _session(**ctx) -> Session:
    s = new_session()
    if ctx:
        set_rls_context(s, **ctx)
    return s


def _ids(session: Session, table: str) -> set[str]:
    return {str(r[0]) for r in session.execute(text(f"SELECT id FROM {table}"))}  # noqa: S608


def test_runtime_role_is_not_privileged(migrated) -> None:
    with new_session() as s:
        row = s.execute(
            text(
                "SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
            )
        ).one()
    assert tuple(row) == ("dg_app", False, False)


def test_rls_without_context_sees_nothing(two_tenants) -> None:
    with _session() as s:
        for table in ("organizations", "memberships", "invitations", "audit_logs"):
            assert _ids(s, table) == set(), table


def test_rls_org_context_sees_only_that_org(two_tenants) -> None:
    org_a, org_b = two_tenants["org_a"], two_tenants["org_b"]
    with _session(org_id=uuid.UUID(org_a)) as s:
        assert _ids(s, "organizations") == {org_a}
        orgs_in_memberships = {
            str(r[0]) for r in s.execute(text("SELECT organization_id FROM memberships"))
        }
        assert orgs_in_memberships == {org_a}
        assert _ids(s, "invitations") == set()  # Beta's invitation is invisible
        audit_orgs = {str(r[0]) for r in s.execute(text("SELECT organization_id FROM audit_logs"))}
        assert audit_orgs == {org_a}
    with _session(org_id=uuid.UUID(org_b)) as s:
        assert len(_ids(s, "invitations")) == 1


def test_rls_user_context_sees_only_own_orgs(two_tenants) -> None:
    with _session(user_id=uuid.UUID(two_tenants["user_a"])) as s:
        assert _ids(s, "organizations") == {two_tenants["org_a"]}


def test_rls_blocks_writes_into_other_tenant(two_tenants) -> None:
    org_a, org_b = two_tenants["org_a"], two_tenants["org_b"]
    with _session(org_id=uuid.UUID(org_a)) as s:
        # Updating Beta silently matches zero rows: it is invisible.
        res = s.execute(text("UPDATE organizations SET name = 'pwned' WHERE id = :b"), {"b": org_b})
        assert res.rowcount == 0
        s.commit()
        # Inserting a membership into Beta violates the WITH CHECK policy.
        with pytest.raises(ProgrammingError, match="row-level security"):
            s.execute(
                text(
                    "INSERT INTO memberships (id, organization_id, user_id, role, created_at) "
                    "VALUES (:id, :org, :user, 'owner', now())"
                ),
                {"id": uuid.uuid4(), "org": org_b, "user": two_tenants["user_a"]},
            )
        s.rollback()
        with pytest.raises(ProgrammingError, match="row-level security"):
            s.execute(
                text(
                    "INSERT INTO audit_logs (organization_id, action, details, created_at) "
                    "VALUES (:org, 'forged', '{}', now())"
                ),
                {"org": org_b},
            )


def test_audit_log_is_append_only_for_runtime_role(two_tenants) -> None:
    with _session(org_id=uuid.UUID(two_tenants["org_a"])) as s:
        for stmt in ("UPDATE audit_logs SET action = 'x'", "DELETE FROM audit_logs"):
            with pytest.raises(DBAPIError, match="permission denied"):
                s.execute(text(stmt))
            s.rollback()


def test_rls_context_does_not_leak_between_transactions(two_tenants) -> None:
    """Pooled connections must not keep a previous request's tenant context."""
    engine_url = get_settings().database_url
    engine = create_engine(engine_url, pool_size=1, max_overflow=0)
    try:
        s1 = Session(engine)
        s1.info["rls"] = RLSContext(org_id=uuid.UUID(two_tenants["org_a"]))
        assert _ids(s1, "organizations") == {two_tenants["org_a"]}
        s1.commit()
        s1.close()
        # Same single pooled connection, new session with no context.
        with Session(engine) as s2:
            assert _ids(s2, "organizations") == set()
    finally:
        engine.dispose()


def test_invitation_visible_only_with_its_token(two_tenants) -> None:
    from app.core.security import hash_token

    token = token_from_last_email("invite")
    with _session(invite_token_hash=hash_token(token)) as s:
        assert len(_ids(s, "invitations")) == 1
    with _session(invite_token_hash=hash_token("not-the-token-at-all")) as s:
        assert _ids(s, "invitations") == set()


# ------------------------------------------------------------------ hosted Postgres (Supabase)


def test_supabase_public_roles_have_no_access(two_tenants, owner_engine) -> None:
    """Supabase's public Data API roles must not reach any table, current or future."""
    from tests.conftest import SUPABASE_PUBLIC_ROLES

    with owner_engine.connect() as conn:
        tables = (
            conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
            .scalars()
            .all()
        )
        assert "users" in tables
        for role in SUPABASE_PUBLIC_ROLES:
            for table in tables:
                for priv in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                    allowed = conn.execute(
                        text("SELECT has_table_privilege(:r, :t, :p)"),
                        {"r": role, "t": f"public.{table}", "p": priv},
                    ).scalar_one()
                    assert not allowed, f"{role} has {priv} on {table}"


def test_every_table_has_row_level_security(owner_engine) -> None:
    with owner_engine.connect() as conn:
        rows = (
            conn.execute(
                text(
                    "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                    "WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity "
                    "AND relname <> 'alembic_version'"
                )
            )
            .scalars()
            .all()
        )
    assert rows == [], f"tables without RLS: {rows}"
