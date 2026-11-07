"""Fixed-window rate limiting stored in PostgreSQL.

Postgres (rather than Redis) keeps the serverless deployment to a single stateful service.
Each hit runs in its own short transaction on a separate connection, so the attempt is
counted even when the request that triggered it later fails and rolls back.
"""

import hashlib
import logging
import secrets

from fastapi import status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import AppError
from app.db.session import get_engine

log = logging.getLogger(__name__)

_HIT = text("""
    INSERT INTO rate_limits AS r (key, count, window_start)
    VALUES (:key, 1, now())
    ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN r.window_start < now() - make_interval(secs => :window)
                     THEN 1 ELSE r.count + 1 END,
        window_start = CASE WHEN r.window_start < now() - make_interval(secs => :window)
                            THEN now() ELSE r.window_start END
    RETURNING count
""")
_RESET = text("DELETE FROM rate_limits WHERE key = :key")
_PURGE = text("DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'")


def _key(scope: str, identity: str) -> str:
    # Hash identities so raw e-mails / IPs are not stored.
    return f"{scope}:{hashlib.sha256(identity.encode()).hexdigest()[:40]}"


def hit(scope: str, identity: str, limit: int, window_seconds: int) -> None:
    """Count one attempt; raise 429 once `limit` is exceeded within the window.

    Fails open if the database is unavailable (logged): the request itself would fail
    anyway, and Argon2 hashing still bounds brute-force throughput.
    """
    try:
        with get_engine().begin() as conn:
            count = conn.execute(
                _HIT, {"key": _key(scope, identity), "window": window_seconds}
            ).scalar_one()
            if secrets.randbelow(200) == 0:  # opportunistic cleanup of stale windows
                conn.execute(_PURGE)
    except SQLAlchemyError:
        log.warning("rate limiter unavailable; failing open", extra={"scope": scope})
        return
    if int(count) > limit:
        raise AppError(status.HTTP_429_TOO_MANY_REQUESTS, "rate_limited")


def reset(scope: str, identity: str) -> None:
    try:
        with get_engine().begin() as conn:
            conn.execute(_RESET, {"key": _key(scope, identity)})
    except SQLAlchemyError:
        pass
