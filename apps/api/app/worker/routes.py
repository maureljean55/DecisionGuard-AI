"""On-demand worker for serverless hosting (Vercel), where no process runs permanently.

The web relay calls this right after an analysis is queued, and a scheduled job calls it as a
safety net. Each call processes queued analyses while there is time left in the function.
"""

import hmac
import os
import socket
import time

from fastapi import APIRouter, Header

from app.core.config import get_settings
from app.core.errors import NotFound
from app.worker.monitoring import schedule_due
from app.worker.pipeline import get_pipeline
from app.worker.queue import process_one, recover_stale

router = APIRouter(include_in_schema=False)


def _authorised(supplied: str | None) -> bool:
    secret = get_settings().relay_secret
    if secret is None or not supplied:
        return False
    return hmac.compare_digest(supplied.encode(), secret.get_secret_value().encode())


@router.api_route("/internal/worker/tick", methods=["GET", "POST"])
def tick(
    authorization: str | None = Header(default=None),
    x_dg_relay_secret: str | None = Header(default=None),
) -> dict[str, list[str]]:
    # Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the relay sends its own header.
    bearer = authorization.removeprefix("Bearer ").strip() if authorization else None
    if not (_authorised(x_dg_relay_secret) or _authorised(bearer)):
        raise NotFound()  # indistinguishable from a missing route
    s = get_settings()
    started = time.monotonic()
    recover_stale(s.analysis_timeout_seconds)
    schedule_due()
    pipeline = get_pipeline(s.analysis_engine)
    worker_id = f"tick:{socket.gethostname()}:{os.getpid()}"[:64]
    outcomes: list[str] = []
    while True:
        outcome = process_one(pipeline, worker_id)
        outcomes.append(outcome)
        if outcome in ("idle", "waiting"):
            break
        # Start another job only if it can finish before the function is stopped.
        if time.monotonic() - started + s.analysis_timeout_seconds > s.worker_tick_max_seconds:
            break
    return {"outcomes": outcomes}
