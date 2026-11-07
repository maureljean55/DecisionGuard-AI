"""Database engine, sessions and the Row-Level Security (RLS) tenant context.

Tenant isolation is enforced twice:
1. In application code (every org-scoped query filters on organization_id, and access checks
   go through `app.orgs.deps`).
2. In PostgreSQL, via RLS policies that read `app.user_id` / `app.org_id` settings. The app
   connects as the unprivileged `dg_app` role, which cannot bypass these policies.

The settings are applied with `set_config(..., is_local => true)` at the start of *every*
transaction, so they never leak between requests through the connection pool.
"""

import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from functools import lru_cache

from sqlalchemy import Connection, Engine, create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, SessionTransaction, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


@dataclass
class RLSContext:
    user_id: uuid.UUID | None = None
    org_id: uuid.UUID | None = None
    # Lets the holder of an invitation token read that single invitation before joining.
    invite_token_hash: str | None = None


_RLS_KEY = "rls"
_SET_RLS = text(
    "SELECT set_config('app.user_id', :user_id, true),"
    " set_config('app.org_id', :org_id, true),"
    " set_config('app.invite_token_hash', :invite, true)"
)


def _rls_params(ctx: RLSContext) -> dict[str, str]:
    return {
        "user_id": str(ctx.user_id) if ctx.user_id else "",
        "org_id": str(ctx.org_id) if ctx.org_id else "",
        "invite": ctx.invite_token_hash or "",
    }


@event.listens_for(Session, "after_begin")
def _apply_rls_on_begin(session: Session, _tx: SessionTransaction, conn: Connection) -> None:
    ctx: RLSContext = session.info.get(_RLS_KEY) or RLSContext()
    conn.execute(_SET_RLS, _rls_params(ctx))


def get_rls_context(session: Session) -> RLSContext:
    return session.info.setdefault(_RLS_KEY, RLSContext())


def set_rls_context(session: Session, **changes: object) -> RLSContext:
    """Update the tenant context; applies immediately to the open transaction, if any."""
    ctx = get_rls_context(session)
    for key, value in changes.items():
        if not hasattr(ctx, key):
            raise AttributeError(key)
        setattr(ctx, key, value)
    if session.in_transaction():
        session.execute(_SET_RLS, _rls_params(ctx))
    return ctx


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().database_url, pool_pre_ping=True, pool_size=10)


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def new_session() -> Session:
    return _session_factory()()


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    session = new_session()
    try:
        yield session
    finally:
        session.close()
