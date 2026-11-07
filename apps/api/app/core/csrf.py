"""CSRF protection (double-submit cookie).

When a request carries the session cookie and uses an unsafe method, it must also send the
`X-CSRF-Token` header with the value of the (non-httpOnly) CSRF cookie. A cross-site attacker
can make the browser send cookies but cannot read them to forge the header.
"""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings
from app.core.errors import error_body
from app.core.i18n import request_locale, translate
from app.core.security import tokens_equal

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "x-csrf-token"


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        settings = get_settings()
        if request.method not in SAFE_METHODS and request.cookies.get(settings.session_cookie_name):
            cookie = request.cookies.get(settings.csrf_cookie_name, "")
            header = request.headers.get(CSRF_HEADER, "")
            if not cookie or not header or not tokens_equal(cookie, header):
                msg = translate("csrf_failed", request_locale(request))
                return JSONResponse(error_body("csrf_failed", msg), status_code=403)
        return await call_next(request)
