"""Request dependencies resolving the authenticated user."""

from typing import Annotated

from fastapi import Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.auth.service import resolve_session
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import new_token
from app.db.session import get_db, set_rls_context
from app.models import AuthSession, User

DB = Annotated[Session, Depends(get_db)]


def current_session(request: Request, db: DB) -> AuthSession:
    token = request.cookies.get(get_settings().session_cookie_name)
    session = resolve_session(db, token) if token else None
    if session is None:
        raise AppError(status.HTTP_401_UNAUTHORIZED, "auth.required")
    set_rls_context(db, user_id=session.user_id)
    return session


def current_user(session: Annotated[AuthSession, Depends(current_session)]) -> User:
    return session.user


CurrentSession = Annotated[AuthSession, Depends(current_session)]
CurrentUser = Annotated[User, Depends(current_user)]


def set_session_cookies(response: Response, session_token: str) -> None:
    s = get_settings()
    max_age = s.session_ttl_hours * 3600
    response.set_cookie(
        s.session_cookie_name,
        session_token,
        max_age=max_age,
        httponly=True,
        secure=s.secure_cookies,
        samesite="lax",
        path="/",
    )
    csrf, _ = new_token()
    # Readable by the front-end JavaScript on purpose (double-submit pattern).
    response.set_cookie(
        s.csrf_cookie_name,
        csrf,
        max_age=max_age,
        httponly=False,
        secure=s.secure_cookies,
        samesite="lax",
        path="/",
    )


def clear_session_cookies(response: Response) -> None:
    s = get_settings()
    for name in (s.session_cookie_name, s.csrf_cookie_name):
        response.delete_cookie(name, path="/", secure=s.secure_cookies, samesite="lax")
