"""Uniform, localized error responses.

Every error body has the shape {"error": {"code": str, "message": str, "details"?: ...}}.
`code` is stable and meant for programs; `message` is localized for humans.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.i18n import request_locale, translate

log = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, status_code: int, code: str, **params: object) -> None:
        super().__init__(code)
        self.status_code = status_code
        self.code = code
        self.params = params


def NotFound() -> AppError:  # noqa: N802 - reads like an exception class
    return AppError(status.HTTP_404_NOT_FOUND, "not_found")


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    err: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        err["details"] = details
    return {"error": err}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        msg = translate(exc.code, request_locale(request), **exc.params)
        return JSONResponse(error_body(exc.code, msg), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"loc": list(e.get("loc", ())), "type": e.get("type"), "msg": e.get("msg")}
            for e in exc.errors()
        ]
        msg = translate("validation_error", request_locale(request))
        return JSONResponse(error_body("validation_error", msg, details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else f"http_{exc.status_code}"
        msg = translate(code, request_locale(request)) if code == "not_found" else str(exc.detail)
        return JSONResponse(error_body(code, msg), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error", extra={"path": request.url.path})
        msg = translate("internal_error", request_locale(request))
        return JSONResponse(error_body("internal_error", msg), status_code=500)
