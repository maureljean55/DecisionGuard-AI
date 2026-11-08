"""Organizations, members, invitations and audit log."""

import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.auth import emails
from app.auth.deps import DB, CurrentUser
from app.auth.schemas import OrganizationCreate, TokenRequest
from app.core import audit, ratelimit
from app.core.email import dispatch_email
from app.core.errors import AppError, NotFound
from app.core.permissions import Permission, Role, can_assign_role, can_manage_member
from app.core.security import hash_token, new_token
from app.db.base import utcnow
from app.db.session import set_rls_context
from app.models import AuditLog, Invitation, Membership, User
from app.orgs.deps import Member, OrgContext, require
from app.orgs.schemas import (
    AuditLogOut,
    AuditLogPage,
    InvitationCreate,
    InvitationOut,
    InvitationPreview,
    MemberOut,
    OrganizationOut,
    OrganizationUpdate,
    OrganizationWithRole,
    RoleUpdate,
)
from app.orgs.service import create_organization

router = APIRouter(tags=["organizations"])
INVITATION_TTL = timedelta(days=7)

CanUpdateOrg = Annotated[OrgContext, Depends(require(Permission.ORG_UPDATE))]
CanReadMembers = Annotated[OrgContext, Depends(require(Permission.MEMBERS_READ))]
CanManageMembers = Annotated[OrgContext, Depends(require(Permission.MEMBERS_MANAGE))]
CanReadAudit = Annotated[OrgContext, Depends(require(Permission.AUDIT_READ))]


def _meta(request: Request) -> audit.RequestMeta:
    return audit.RequestMeta.from_request(request)


# ------------------------------------------------------------------ organizations


@router.post("/orgs", response_model=OrganizationWithRole, status_code=status.HTTP_201_CREATED)
def create_org(body: OrganizationCreate, user: CurrentUser, request: Request, db: DB):
    ratelimit.hit("org:create", str(user.id), limit=10, window_seconds=86400)
    org = create_organization(db, user, body)
    audit.record(
        db,
        "org.create",
        _meta(request),
        org_id=org.id,
        actor_id=user.id,
        target_type="organization",
        target_id=org.id,
    )
    db.commit()
    return OrganizationWithRole(**OrganizationOut.model_validate(org).model_dump(), role=Role.OWNER)


@router.get("/orgs/{org_id}", response_model=OrganizationWithRole)
def get_org(ctx: Member):
    return OrganizationWithRole(
        **OrganizationOut.model_validate(ctx.org).model_dump(), role=ctx.membership.role
    )


@router.patch("/orgs/{org_id}", response_model=OrganizationOut)
def update_org(body: OrganizationUpdate, ctx: CanUpdateOrg, request: Request):
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(ctx.org, field, value.strip() if isinstance(value, str) else value)
    audit.record(
        ctx.db,
        "org.update",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="organization",
        target_id=ctx.org_id,
        details={"fields": sorted(changes)},
    )
    ctx.db.commit()
    return ctx.org


# ------------------------------------------------------------------ members


@router.get("/orgs/{org_id}/members", response_model=list[MemberOut])
def list_members(ctx: CanReadMembers):
    rows = ctx.db.execute(
        select(Membership, User)
        .join(User, User.id == Membership.user_id)
        .where(Membership.organization_id == ctx.org_id)
        .order_by(Membership.created_at)
    ).all()
    return [
        MemberOut(
            id=m.id,
            user_id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=m.role,
            joined_at=m.created_at,
        )
        for m, u in rows
    ]


def _get_membership(ctx: OrgContext, membership_id: uuid.UUID) -> Membership:
    target = ctx.db.scalar(
        select(Membership)
        .where(Membership.id == membership_id, Membership.organization_id == ctx.org_id)
        .with_for_update()
    )
    if target is None:
        raise NotFound()
    return target


def _ensure_not_last_owner(db: Session, org_id: uuid.UUID, target: Membership) -> None:
    if target.role != Role.OWNER:
        return
    # Lock all owner rows so two concurrent demotions cannot both succeed.
    owners = db.scalars(
        select(Membership.id)
        .where(Membership.organization_id == org_id, Membership.role == Role.OWNER)
        .with_for_update()
    ).all()
    if len(owners) <= 1:
        raise AppError(status.HTTP_409_CONFLICT, "org.last_owner")


@router.patch("/orgs/{org_id}/members/{membership_id}", response_model=MemberOut)
def change_role(
    membership_id: uuid.UUID, body: RoleUpdate, ctx: CanManageMembers, request: Request
):
    target = _get_membership(ctx, membership_id)
    actor = ctx.membership.role
    if not can_manage_member(actor, target.role) or not can_assign_role(actor, body.role):
        raise AppError(status.HTTP_403_FORBIDDEN, "org.forbidden")
    if body.role != Role.OWNER:
        _ensure_not_last_owner(ctx.db, ctx.org_id, target)
    previous = target.role
    target.role = body.role
    audit.record(
        ctx.db,
        "member.role_change",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="membership",
        target_id=target.id,
        details={"from": previous.value, "to": body.role.value},
    )
    ctx.db.commit()
    user = ctx.db.get(User, target.user_id)
    if user is None:
        raise NotFound()
    return MemberOut(
        id=target.id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=target.role,
        joined_at=target.created_at,
    )


@router.delete("/orgs/{org_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(membership_id: uuid.UUID, ctx: Member, request: Request) -> None:
    target = _get_membership(ctx, membership_id)
    leaving_self = target.user_id == ctx.user.id
    if not leaving_self and not can_manage_member(ctx.membership.role, target.role):
        raise AppError(status.HTTP_403_FORBIDDEN, "org.forbidden")
    _ensure_not_last_owner(ctx.db, ctx.org_id, target)
    audit.record(
        ctx.db,
        "member.leave" if leaving_self else "member.remove",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="membership",
        target_id=target.id,
        details={"user_id": str(target.user_id)},
    )
    ctx.db.delete(target)
    ctx.db.commit()


# ------------------------------------------------------------------ invitations


def _pending(q):  # type: ignore[no-untyped-def]
    return q.where(
        Invitation.accepted_at.is_(None),
        Invitation.revoked_at.is_(None),
        Invitation.expires_at > utcnow(),
    )


@router.get("/orgs/{org_id}/invitations", response_model=list[InvitationOut])
def list_invitations(ctx: CanManageMembers):
    return ctx.db.scalars(
        _pending(select(Invitation).where(Invitation.organization_id == ctx.org_id)).order_by(
            Invitation.created_at.desc()
        )
    ).all()


@router.post(
    "/orgs/{org_id}/invitations", response_model=InvitationOut, status_code=status.HTTP_201_CREATED
)
def create_invitation(
    body: InvitationCreate, ctx: CanManageMembers, request: Request, tasks: BackgroundTasks
):
    ratelimit.hit("invite:org", str(ctx.org_id), limit=50, window_seconds=86400)
    if not can_assign_role(ctx.membership.role, body.role):
        raise AppError(status.HTTP_403_FORBIDDEN, "org.forbidden")
    email = body.email.lower()
    already = ctx.db.scalar(
        select(func.count())
        .select_from(Membership)
        .join(User, User.id == Membership.user_id)
        .where(Membership.organization_id == ctx.org_id, User.email == email)
    )
    if already:
        raise AppError(status.HTTP_409_CONFLICT, "org.already_member")

    # A new invitation replaces any pending one for the same address.
    ctx.db.execute(
        _pending(
            update(Invitation).where(
                Invitation.organization_id == ctx.org_id, Invitation.email == email
            )
        ).values(revoked_at=utcnow())
    )
    token, digest = new_token()
    invitation = Invitation(
        organization_id=ctx.org_id,
        email=email,
        role=body.role,
        token_hash=digest,
        invited_by_user_id=ctx.user.id,
        expires_at=utcnow() + INVITATION_TTL,
    )
    ctx.db.add(invitation)
    ctx.db.flush()
    audit.record(
        ctx.db,
        "invitation.create",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="invitation",
        target_id=invitation.id,
        details={"role": body.role.value},
    )
    ctx.db.commit()

    locale = ctx.org.default_locale
    dispatch_email(
        tasks,
        emails.invitation_email(
            email, ctx.user.full_name, ctx.org.name, body.role.value, token, locale
        ),
    )  # type: ignore[arg-type]
    return invitation


@router.delete("/orgs/{org_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(invitation_id: uuid.UUID, ctx: CanManageMembers, request: Request) -> None:
    invitation = ctx.db.scalar(
        _pending(
            select(Invitation).where(
                Invitation.id == invitation_id, Invitation.organization_id == ctx.org_id
            )
        )
    )
    if invitation is None:
        raise NotFound()
    invitation.revoked_at = utcnow()
    audit.record(
        ctx.db,
        "invitation.revoke",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="invitation",
        target_id=invitation.id,
    )
    ctx.db.commit()


def _load_invitation_by_token(db: Session, token: str) -> Invitation:
    digest = hash_token(token)
    set_rls_context(db, invite_token_hash=digest)
    invitation = db.scalar(_pending(select(Invitation).where(Invitation.token_hash == digest)))
    if invitation is None:
        raise AppError(status.HTTP_400_BAD_REQUEST, "auth.invalid_token")
    # The token holder may see the inviting organization's name.
    set_rls_context(db, org_id=invitation.organization_id)
    return invitation


@router.get("/invitations/preview", response_model=InvitationPreview)
def preview_invitation(
    token: Annotated[str, Query(min_length=16, max_length=128)], request: Request, db: DB
):
    ratelimit.hit("token:ip", audit.client_ip(request) or "unknown", limit=30, window_seconds=3600)
    inv = _load_invitation_by_token(db, token)
    return InvitationPreview(
        organization_name=inv.organization.name, email=inv.email, role=inv.role
    )


@router.post("/invitations/accept", response_model=OrganizationWithRole)
def accept_invitation(body: TokenRequest, user: CurrentUser, request: Request, db: DB):
    inv = _load_invitation_by_token(db, body.token)
    if inv.email.lower() != user.email.lower():
        raise AppError(status.HTTP_403_FORBIDDEN, "invitation.email_mismatch")

    existing = db.scalar(
        select(Membership).where(
            Membership.organization_id == inv.organization_id, Membership.user_id == user.id
        )
    )
    membership = existing or Membership(
        organization_id=inv.organization_id, user_id=user.id, role=inv.role
    )
    if existing is None:
        db.add(membership)
    inv.accepted_at = utcnow()
    if user.email_verified_at is None:  # the invitation link proves mailbox control
        user.email_verified_at = utcnow()
    audit.record(
        db,
        "invitation.accept",
        _meta(request),
        org_id=inv.organization_id,
        actor_id=user.id,
        target_type="invitation",
        target_id=inv.id,
    )
    db.commit()
    return OrganizationWithRole(
        **OrganizationOut.model_validate(inv.organization).model_dump(), role=membership.role
    )


# ------------------------------------------------------------------ audit log


@router.get("/orgs/{org_id}/audit-logs", response_model=AuditLogPage)
def list_audit_logs(
    ctx: CanReadAudit,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before_id: Annotated[int | None, Query(ge=1)] = None,
):
    q = select(AuditLog).where(AuditLog.organization_id == ctx.org_id)
    if before_id:
        q = q.where(AuditLog.id < before_id)
    items = list(ctx.db.scalars(q.order_by(AuditLog.id.desc()).limit(limit + 1)))
    has_more = len(items) > limit
    items = items[:limit]
    actor_ids = {i.actor_user_id for i in items if i.actor_user_id}
    actors = {
        u.id: u
        for u in (ctx.db.scalars(select(User).where(User.id.in_(actor_ids))) if actor_ids else [])
    }
    out = []
    for i in items:
        row = AuditLogOut.model_validate(i)
        actor = actors.get(i.actor_user_id) if i.actor_user_id else None
        if actor:
            row.actor_name, row.actor_email = actor.full_name, actor.email
        out.append(row)
    return AuditLogPage(items=out, next_before_id=items[-1].id if has_more else None)
