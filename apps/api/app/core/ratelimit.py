"""Fixed-window rate limiting backed by Redis."""

import hashlib
import logging
from functools import lru_cache

import redis
from fastapi import status

from app.core.config import get_settings
from app.core.errors import AppError

log = logging.getLogger(__name__)


@lru_cache
def _client() -> redis.Redis:
    return redis.Redis.from_url(get_settings().redis_url, socket_timeout=1)


def _key(scope: str, identity: str) -> str:
    # Hash identities so raw e-mails / IPs are not stored in Redis.
    return f"rl:{scope}:{hashlib.sha256(identity.encode()).hexdigest()[:32]}"


def hit(scope: str, identity: str, limit: int, window_seconds: int) -> None:
    """Count one attempt; raise 429 once `limit` is exceeded within the window.

    Fails open if Redis is unavailable (logged): availability of login is preferred over a
    hard dependency on the cache. Argon2 hashing still bounds brute-force throughput.
    """
    key = _key(scope, identity)
    try:
        pipe = _client().pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds, nx=True)
        count, _ = pipe.execute()
    except redis.RedisError:
        log.warning("rate limiter unavailable; failing open", extra={"scope": scope})
        return
    if int(count) > limit:
        raise AppError(status.HTTP_429_TOO_MANY_REQUESTS, "rate_limited")


def reset(scope: str, identity: str) -> None:
    try:
        _client().delete(_key(scope, identity))
    except redis.RedisError:
        pass
