"""Write security audit events. Rows are append-only (no UPDATE/DELETE grant at DB level)."""

import ipaddress
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import insert
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.config import get_settings
from app.core.security import tokens_equal
from app.db.base import utcnow
from app.models.audit import AuditLog


def client_ip(request: Request) -> str | None:
    """Best-known client IP, or None if it is not a valid address.

    Behind the web relay (e.g. both apps on a serverless platform), the TCP peer is the relay
    itself; the relay forwards the browser's IP in X-DG-Client-IP, trusted only when the
    shared secret X-DG-Relay-Secret matches DG_RELAY_SECRET.
    """
    host = request.client.host if request.client else None
    secret = get_settings().relay_secret
    if secret is not None:
        sent = request.headers.get("x-dg-relay-secret", "")
        if sent and tokens_equal(sent, secret.get_secret_value()):
            host = request.headers.get("x-dg-client-ip", "").split(",")[0].strip() or host
    try:
        return str(ipaddress.ip_address(host)) if host else None
    except ValueError:
        return None


@dataclass(frozen=True)
class RequestMeta:
    ip: str | None
    user_agent: str | None

    @classmethod
    def from_request(cls, request: Request) -> "RequestMeta":
        ip = client_ip(request)
        ua = request.headers.get("user-agent")
        return cls(ip=ip, user_agent=ua[:500] if ua else None)


def record(
    db: Session,
    action: str,
    meta: RequestMeta,
    *,
    org_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: object = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Write an audit event in the current transaction (committed with the action itself).

    Plain INSERT without RETURNING (see AuditLog.__table_args__).
    """
    db.flush()  # pending rows referenced by foreign keys (e.g. a new organization) go first
    db.execute(
        insert(AuditLog.__table__).values(
            organization_id=org_id,
            actor_user_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            ip=meta.ip,
            user_agent=meta.user_agent,
            details=details or {},
            created_at=utcnow(),
        )
    )
