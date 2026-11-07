"""FastAPI application entrypoint."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.auth.routes import router as auth_router
from app.core.config import get_settings
from app.core.csrf import CSRFMiddleware
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.orgs.routes import router as orgs_router


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)

    app = FastAPI(
        title=settings.app_name,
        version="0.2.0",
        # Interactive docs are disabled in production; the OpenAPI schema is exported in CI.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    install_error_handlers(app)
    # Order: last added runs first. CORS must wrap CSRF so preflights are answered.
    app.add_middleware(CSRFMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Accept-Language", "X-CSRF-Token"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(orgs_router)

    logging.getLogger(__name__).info(
        "application started",
        extra={"environment": settings.environment, "llm_provider": settings.llm_provider},
    )
    return app


app = create_app()
