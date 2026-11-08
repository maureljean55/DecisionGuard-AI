"""Run the analysis worker: `python -m app.worker`."""

import logging
import os
import signal
import socket
import time

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.worker.pipeline import get_pipeline
from app.worker.queue import process_one, recover_stale

log = logging.getLogger("app.worker")


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)
    worker_id = f"{socket.gethostname()}:{os.getpid()}"[:64]
    pipeline = get_pipeline(settings.analysis_engine)
    stopping = False

    def stop(*_: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    log.info("worker started", extra={"worker": worker_id, "engine": settings.analysis_engine})
    last_recovery = 0.0
    while not stopping:
        try:
            if time.monotonic() - last_recovery > 60:
                recover_stale(settings.analysis_timeout_seconds)
                last_recovery = time.monotonic()
            outcome = process_one(pipeline, worker_id)
        except Exception:  # noqa: BLE001 - keep the worker alive (DB restart, network blip)
            log.exception("worker loop error")
            outcome = "idle"
        if outcome in ("idle", "waiting"):
            time.sleep(settings.worker_poll_seconds)
    log.info("worker stopped", extra={"worker": worker_id})


if __name__ == "__main__":
    main()
