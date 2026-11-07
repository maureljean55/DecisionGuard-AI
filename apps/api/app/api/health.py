"""Liveness and readiness probes."""

import logging
from typing import Literal

import redis
from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine

router = APIRouter(tags=["health"])
log = logging.getLogger(__name__)

CheckState = Literal["ok", "error"]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    environment: str
    checks: dict[str, CheckState]


@router.get("/health/live")
def live() -> dict[str, str]:
    """Process is up. Does not touch dependencies."""
    return {"status": "ok"}


def _check_database() -> CheckState:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        log.exception("database health check failed")
        return "error"


def _check_redis() -> CheckState | None:
    url = get_settings().redis_url
    if url is None:  # not used by this deployment (serverless)
        return None
    try:
        client = redis.Redis.from_url(url, socket_timeout=2)
        client.ping()
        return "ok"
    except Exception:
        log.exception("redis health check failed")
        return "error"


@router.get("/health", response_model=HealthResponse)
def health(response: Response) -> HealthResponse:
    """Readiness: verifies every backing service. Returns 503 if any is down."""
    checks: dict[str, CheckState] = {"database": _check_database()}
    redis_state = _check_redis()
    if redis_state is not None:
        checks["redis"] = redis_state
    healthy = all(v == "ok" for v in checks.values())
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="ok" if healthy else "degraded",
        environment=get_settings().environment,
        checks=checks,
    )
