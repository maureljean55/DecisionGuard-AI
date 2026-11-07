"""Authentication endpoints: register, login, logout, e-mail verification, passwords."""

from fastapi import APIRouter, BackgroundTasks, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import emails
from app.auth import service as auth
from app.auth.deps import (
    DB,
    CurrentSession,
    CurrentUser,
    clear_session_cookies,
    set_session_cookies,
)
from app.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MembershipOut,
    MeOut,
    OrganizationSummary,
    RegisterRequest,
    ResetPasswordRequest,
    TokenRequest,
    UserOut,
)
from app.core import audit, ratelimit
from app.core.config import get_settings
from app.core.email import send_email
from app.core.errors import AppError
from app.core.security import hash_password, needs_rehash, verify_password
from app.db.base import utcnow
from app.db.session import set_rls_context
from app.models import TokenPurpose, User
from app.orgs.service import create_organization

router = APIRouter(prefix="/auth", tags=["auth"])


def _me(db: Session, user: User) -> MeOut:
    set_rls_context(db, user_id=user.id)
    memberships = auth.list_memberships(db, user.id)
    return MeOut(
        user=UserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            locale=user.locale,  # type: ignore[arg-type]
            email_verified=user.email_verified_at is not None,
        ),
        memberships=[
            MembershipOut(
                organization=OrganizationSummary.model_validate(m.organization), role=m.role
            )
            for m in memberships
        ],
    )


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/register", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest, request: Request, response: Response, db: DB, tasks: BackgroundTasks
) -> MeOut:
    ratelimit.hit("register:ip", _client_ip(request), limit=10, window_seconds=3600)
    email = body.email.lower()
    auth.validate_password(body.password, email)
    if auth.get_user_by_email(db, email):
        raise AppError(status.HTTP_409_CONFLICT, "auth.email_taken")

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        locale=body.locale,
        is_active=True,
        is_platform_admin=False,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:  # concurrent registration with the same e-mail
        db.rollback()
        raise AppError(status.HTTP_409_CONFLICT, "auth.email_taken") from None

    meta = audit.RequestMeta.from_request(request)
    org_id = None
    if body.organization is not None:
        org = create_organization(db, user, body.organization)
        org_id = org.id
        audit.record(
            db,
            "org.create",
            meta,
            org_id=org.id,
            actor_id=user.id,
            target_type="organization",
            target_id=org.id,
        )
    audit.record(
        db,
        "auth.register",
        meta,
        org_id=org_id,
        actor_id=user.id,
        target_type="user",
        target_id=user.id,
    )
    verify_token = auth.issue_token(db, user, TokenPurpose.VERIFY_EMAIL)
    session_token = auth.create_session(db, user, meta.ip, meta.user_agent)
    db.commit()

    tasks.add_task(
        send_email, emails.verification_email(user.email, user.full_name, verify_token, body.locale)
    )
    set_session_cookies(response, session_token)
    return _me(db, user)


@router.post("/login", response_model=MeOut)
def login(body: LoginRequest, request: Request, response: Response, db: DB) -> MeOut:
    s = get_settings()
    email = body.email.lower()
    ip = _client_ip(request)
    ratelimit.hit(
        "login:ip", ip, limit=s.login_rate_limit * 5, window_seconds=s.login_rate_window_seconds
    )
    ratelimit.hit(
        "login:email", email, limit=s.login_rate_limit, window_seconds=s.login_rate_window_seconds
    )

    user = auth.get_user_by_email(db, email)
    valid = verify_password(user.password_hash if user else None, body.password)
    meta = audit.RequestMeta.from_request(request)
    if not valid or user is None or not user.is_active:
        audit.record(
            db,
            "auth.login_failed",
            meta,
            actor_id=user.id if user else None,
            details={"reason": "invalid_credentials"},
        )
        db.commit()
        raise AppError(status.HTTP_401_UNAUTHORIZED, "auth.invalid_credentials")

    ratelimit.reset("login:email", email)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
    token = auth.create_session(db, user, meta.ip, meta.user_agent)
    audit.record(db, "auth.login", meta, actor_id=user.id, target_type="user", target_id=user.id)
    db.commit()
    set_session_cookies(response, token)
    return _me(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(session: CurrentSession, request: Request, response: Response, db: DB) -> None:
    session.revoked_at = utcnow()
    audit.record(
        db, "auth.logout", audit.RequestMeta.from_request(request), actor_id=session.user_id
    )
    db.commit()
    clear_session_cookies(response)


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser, db: DB) -> MeOut:
    return _me(db, user)


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
def verify_email(body: TokenRequest, request: Request, db: DB) -> None:
    ratelimit.hit("token:ip", _client_ip(request), limit=30, window_seconds=3600)
    user = auth.consume_token(db, body.token, TokenPurpose.VERIFY_EMAIL)
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
    audit.record(
        db,
        "auth.email_verified",
        audit.RequestMeta.from_request(request),
        actor_id=user.id,
        target_type="user",
        target_id=user.id,
    )
    db.commit()


@router.post("/verify-email/resend", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(user: CurrentUser, db: DB, tasks: BackgroundTasks) -> None:
    ratelimit.hit("verify:resend", str(user.id), limit=5, window_seconds=3600)
    if user.email_verified_at is not None:
        return
    token = auth.issue_token(db, user, TokenPurpose.VERIFY_EMAIL)
    db.commit()
    tasks.add_task(
        send_email, emails.verification_email(user.email, user.full_name, token, user.locale)
    )  # type: ignore[arg-type]


@router.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    body: ForgotPasswordRequest, request: Request, db: DB, tasks: BackgroundTasks
) -> None:
    """Always 202, whether or not the account exists (no account enumeration)."""
    email = body.email.lower()
    ratelimit.hit("forgot:ip", _client_ip(request), limit=10, window_seconds=3600)
    ratelimit.hit("forgot:email", email, limit=3, window_seconds=3600)
    user = auth.get_user_by_email(db, email)
    if user is None or not user.is_active:
        return
    token = auth.issue_token(db, user, TokenPurpose.RESET_PASSWORD)
    audit.record(
        db,
        "auth.password_reset_requested",
        audit.RequestMeta.from_request(request),
        actor_id=user.id,
    )
    db.commit()
    tasks.add_task(
        send_email, emails.password_reset_email(user.email, user.full_name, token, user.locale)
    )  # type: ignore[arg-type]


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetPasswordRequest, request: Request, db: DB) -> None:
    ratelimit.hit("token:ip", _client_ip(request), limit=30, window_seconds=3600)
    user = auth.consume_token(db, body.token, TokenPurpose.RESET_PASSWORD)
    auth.set_password(user, body.password)
    # The reset link proves control of the mailbox.
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
    auth.revoke_all_sessions(db, user.id)
    audit.record(
        db,
        "auth.password_reset",
        audit.RequestMeta.from_request(request),
        actor_id=user.id,
        target_type="user",
        target_id=user.id,
    )
    db.commit()


@router.post("/password/change", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest, session: CurrentSession, request: Request, db: DB
) -> None:
    user = session.user
    ratelimit.hit("password:change", str(user.id), limit=10, window_seconds=3600)
    if not verify_password(user.password_hash, body.current_password):
        raise AppError(status.HTTP_400_BAD_REQUEST, "auth.wrong_password")
    auth.set_password(user, body.new_password)
    auth.revoke_all_sessions(db, user.id, except_id=session.id)
    audit.record(
        db,
        "auth.password_changed",
        audit.RequestMeta.from_request(request),
        actor_id=user.id,
        target_type="user",
        target_id=user.id,
    )
    db.commit()
