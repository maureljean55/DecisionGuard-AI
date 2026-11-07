"""Authentication business logic: passwords, sessions, single-use tokens."""

import uuid
from datetime import datetime, timedelta

from fastapi import status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import hash_password, hash_token, new_token
from app.db.base import utcnow
from app.models import AuthSession, Membership, TokenPurpose, User, UserToken

TOKEN_TTL: dict[TokenPurpose, timedelta] = {
    TokenPurpose.VERIFY_EMAIL: timedelta(hours=48),
    TokenPurpose.RESET_PASSWORD: timedelta(hours=1),
}
SESSION_TOUCH_INTERVAL = timedelta(minutes=5)


def validate_password(password: str, email: str) -> None:
    min_len = get_settings().password_min_length
    if len(password) < min_len:
        raise AppError(status.HTTP_422_UNPROCESSABLE_CONTENT, "auth.weak_password", min=min_len)
    local_part = email.split("@")[0].lower()
    if len(local_part) >= 4 and local_part in password.lower():
        raise AppError(status.HTTP_422_UNPROCESSABLE_CONTENT, "auth.password_contains_email")


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


# ------------------------------------------------------------------ sessions


def create_session(db: Session, user: User, ip: str | None, user_agent: str | None) -> str:
    token, digest = new_token()
    now = utcnow()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=digest,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(hours=get_settings().session_ttl_hours),
            ip=ip,
            user_agent=user_agent,
        )
    )
    return token


def resolve_session(db: Session, token: str) -> AuthSession | None:
    now = utcnow()
    session = db.scalar(
        select(AuthSession)
        .join(AuthSession.user)
        .where(
            AuthSession.token_hash == hash_token(token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
            User.is_active.is_(True),
        )
    )
    if session and now - session.last_seen_at > SESSION_TOUCH_INTERVAL:
        session.last_seen_at = now
        db.commit()
    return session


def revoke_all_sessions(
    db: Session, user_id: uuid.UUID, except_id: uuid.UUID | None = None
) -> None:
    stmt = update(AuthSession).where(
        AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)
    )
    if except_id:
        stmt = stmt.where(AuthSession.id != except_id)
    db.execute(stmt.values(revoked_at=utcnow()))


# ------------------------------------------------------------------ single-use tokens


def issue_token(db: Session, user: User, purpose: TokenPurpose) -> str:
    # Invalidate previous unused tokens of the same purpose: only the latest link works.
    db.execute(
        update(UserToken)
        .where(
            UserToken.user_id == user.id, UserToken.purpose == purpose, UserToken.used_at.is_(None)
        )
        .values(used_at=utcnow())
    )
    token, digest = new_token()
    db.add(
        UserToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=digest,
            expires_at=utcnow() + TOKEN_TTL[purpose],
        )
    )
    return token


def consume_token(db: Session, token: str, purpose: TokenPurpose) -> User:
    """Mark a token as used and return its user. Row lock prevents double use."""
    record = db.scalar(
        select(UserToken)
        .where(UserToken.token_hash == hash_token(token), UserToken.purpose == purpose)
        .with_for_update()
    )
    now: datetime = utcnow()
    if record is None or record.used_at is not None or record.expires_at <= now:
        raise AppError(status.HTTP_400_BAD_REQUEST, "auth.invalid_token")
    record.used_at = now
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise AppError(status.HTTP_400_BAD_REQUEST, "auth.invalid_token")
    return user


def set_password(user: User, password: str) -> None:
    validate_password(password, user.email)
    user.password_hash = hash_password(password)


def list_memberships(db: Session, user_id: uuid.UUID) -> list[Membership]:
    """Requires RLS context user_id = user_id (memberships policy)."""
    return list(
        db.scalars(
            select(Membership).where(Membership.user_id == user_id).order_by(Membership.created_at)
        )
    )
