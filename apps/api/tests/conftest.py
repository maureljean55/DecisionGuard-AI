"""Test configuration.

Integration tests run against the real Postgres (database `decisionguard_test`)
from docker compose, connecting as the unprivileged `dg_app` role exactly like production.
They are skipped when Postgres is unreachable, unless DG_REQUIRE_INTEGRATION=1 (CI).
"""

import os

_PG_HOST = os.environ.get("DG_TEST_PG_HOST", "localhost")
os.environ.update(
    DG_ENVIRONMENT="test",
    DG_LOG_JSON="false",
    DG_LOG_LEVEL="WARNING",
    DG_DATABASE_URL=f"postgresql+psycopg://dg_app:dg_app_dev@{_PG_HOST}:5432/decisionguard_test",
    DG_MIGRATION_DATABASE_URL=(
        f"postgresql+psycopg://decisionguard:decisionguard@{_PG_HOST}:5432/decisionguard_test"
    ),
    DG_REDIS_URL="",
    DG_RELAY_SECRET="test-relay-secret",
    DG_PUBLIC_WEB_URL="http://web.test",
)

from collections.abc import Iterator  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.email import test_outbox  # noqa: E402

TABLES = (
    "audit_logs, invitations, memberships, organizations, user_tokens, auth_sessions, users, "
    "rate_limits, decisions, analyses, decision_questions, agent_runs, findings"
)

# Simulates Supabase: these roles back its public Data API and, by default, receive
# privileges on every new table in `public`. Migrations must revoke them.
SUPABASE_PUBLIC_ROLES = ("anon", "authenticated")
_SIMULATE_SUPABASE = """
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO %I', r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO %I', r);
  END LOOP;
END $$;
"""


def _services_available() -> str | None:
    s = get_settings()
    try:
        with create_engine(s.migration_database_url).connect() as c:
            c.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        return f"Postgres unavailable ({type(exc).__name__}); run `docker compose up -d`"
    return None


@pytest.fixture(scope="session")
def migrated() -> Iterator[None]:
    reason = _services_available()
    if reason:
        if os.environ.get("DG_REQUIRE_INTEGRATION") == "1":
            pytest.fail(reason)
        pytest.skip(reason)
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option(
        "script_location", os.path.join(os.path.dirname(__file__), "..", "migrations")
    )
    command.downgrade(cfg, "base")
    engine = create_engine(get_settings().migration_database_url)
    with engine.begin() as conn:
        conn.execute(text(_SIMULATE_SUPABASE))
    engine.dispose()
    command.upgrade(cfg, "head")
    yield


@pytest.fixture
def clean(migrated: None) -> Iterator[None]:
    s = get_settings()
    engine = create_engine(s.migration_database_url)
    with engine.begin() as c:
        c.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
    engine.dispose()
    test_outbox.clear()
    yield


@pytest.fixture
def owner_engine(migrated: None):
    """Superuser/owner connection, for arranging data and checking DB state directly."""
    engine = create_engine(get_settings().migration_database_url)
    yield engine
    engine.dispose()


class ApiClient(TestClient):
    """TestClient that sends the CSRF header automatically, like the web front-end does."""

    def request(self, method, url, **kwargs):  # type: ignore[override]
        if method.upper() not in ("GET", "HEAD", "OPTIONS"):
            csrf = self.cookies.get(get_settings().csrf_cookie_name)
            if csrf:
                headers = dict(kwargs.pop("headers", None) or {})
                headers.setdefault("X-CSRF-Token", csrf)
                kwargs["headers"] = headers
        return super().request(method, url, **kwargs)


@pytest.fixture
def make_client(clean: None):
    from app.main import app

    clients: list[ApiClient] = []

    def factory() -> ApiClient:
        c = ApiClient(app)
        clients.append(c)
        return c

    yield factory
    for c in clients:
        c.close()


STRONG_PASSWORD = "correct-horse-battery-staple"  # noqa: S105 - synthetic test credential


def register(client: ApiClient, email: str, org_name: str = "Acme SARL", **extra) -> dict:
    payload = {
        "email": email,
        "password": STRONG_PASSWORD,
        "full_name": email.split("@")[0].title(),
        "locale": "fr",
        "organization": {"name": org_name, "country_code": "CM", "currency": "XAF"},
        **extra,
    }
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def token_from_last_email(path: str) -> str:
    """Extract the single-use token from the latest e-mail containing `path`."""
    for msg in reversed(test_outbox):
        marker = f"/{path}?token="
        if marker in msg.body:
            return msg.body.split(marker, 1)[1].split()[0]
    raise AssertionError(f"no e-mail with link to {path}")
