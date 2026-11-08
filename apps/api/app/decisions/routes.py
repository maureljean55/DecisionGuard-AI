"""Decisions: create, list, read, update, archive, delete. Analysis comes with the agents (M5)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select

from app.core import audit, ratelimit
from app.core.errors import AppError, NotFound
from app.core.permissions import Permission, Role
from app.db.base import utcnow
from app.decisions.schemas import DecisionCreate, DecisionOut, DecisionUpdate
from app.models import Decision, DecisionStatus, User
from app.orgs.deps import OrgContext, require

router = APIRouter(tags=["decisions"])

CanRead = Annotated[OrgContext, Depends(require(Permission.DECISIONS_READ))]
CanWrite = Annotated[OrgContext, Depends(require(Permission.DECISIONS_WRITE))]


def _meta(request: Request) -> audit.RequestMeta:
    return audit.RequestMeta.from_request(request)


def _out(ctx: OrgContext, rows: list[Decision]) -> list[DecisionOut]:
    ids = {r.created_by_user_id for r in rows if r.created_by_user_id}
    names = (
        {u.id: u.full_name for u in ctx.db.scalars(select(User).where(User.id.in_(ids)))}
        if ids
        else {}
    )
    out = []
    for r in rows:
        o = DecisionOut.model_validate(r)
        o.created_by_name = names.get(r.created_by_user_id) if r.created_by_user_id else None
        out.append(o)
    return out


def _get(ctx: OrgContext, decision_id: uuid.UUID) -> Decision:
    d = ctx.db.scalar(
        select(Decision).where(Decision.id == decision_id, Decision.organization_id == ctx.org_id)
    )
    if d is None:
        raise NotFound()
    return d


@router.get("/orgs/{org_id}/decisions", response_model=list[DecisionOut])
def list_decisions(
    ctx: CanRead,
    status_filter: Annotated[DecisionStatus | None, Query(alias="status")] = None,
):
    q = select(Decision).where(Decision.organization_id == ctx.org_id)
    if status_filter:
        q = q.where(Decision.status == status_filter)
    else:
        q = q.where(Decision.status != DecisionStatus.ARCHIVED)
    rows = list(ctx.db.scalars(q.order_by(Decision.updated_at.desc()).limit(200)))
    return _out(ctx, rows)


@router.post(
    "/orgs/{org_id}/decisions", response_model=DecisionOut, status_code=status.HTTP_201_CREATED
)
def create_decision(body: DecisionCreate, ctx: CanWrite, request: Request):
    ratelimit.hit("decision:create", str(ctx.org_id), limit=100, window_seconds=86400)
    now = utcnow()
    d = Decision(
        id=uuid.uuid4(),
        organization_id=ctx.org_id,
        created_by_user_id=ctx.user.id,
        title=body.title.strip(),
        description=body.description.strip(),
        context=(body.context or "").strip() or None,
        category=body.category,
        status=DecisionStatus.SUBMITTED if body.submit else DecisionStatus.DRAFT,
        amount=body.amount,
        currency=body.currency or (ctx.org.currency if body.amount is not None else None),
        deadline=body.deadline,
        submitted_at=now if body.submit else None,
    )
    ctx.db.add(d)
    ctx.db.flush()
    audit.record(
        ctx.db,
        "decision.submit" if body.submit else "decision.create",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="decision",
        target_id=d.id,
        details={"title": d.title[:120]},
    )
    ctx.db.commit()
    return _out(ctx, [d])[0]


@router.get("/orgs/{org_id}/decisions/{decision_id}", response_model=DecisionOut)
def get_decision(decision_id: uuid.UUID, ctx: CanRead):
    return _out(ctx, [_get(ctx, decision_id)])[0]


@router.patch("/orgs/{org_id}/decisions/{decision_id}", response_model=DecisionOut)
def update_decision(decision_id: uuid.UUID, body: DecisionUpdate, ctx: CanWrite, request: Request):
    d = _get(ctx, decision_id)
    changes = body.model_dump(exclude_unset=True)
    new_status = changes.pop("status", None)
    for field, value in changes.items():
        if field in ("title", "description") and value is not None:
            value = value.strip()
        if field == "context":
            value = (value or "").strip() or None
        setattr(d, field, value)
    if d.amount is not None and not d.currency:
        d.currency = ctx.org.currency
    action = "decision.update"
    if new_status and new_status != d.status:
        d.status = DecisionStatus(new_status)
        if d.status == DecisionStatus.SUBMITTED:
            d.submitted_at = utcnow()
            action = "decision.submit"
        elif d.status == DecisionStatus.ARCHIVED:
            action = "decision.archive"
        else:
            action = "decision.reopen"
    audit.record(
        ctx.db,
        action,
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="decision",
        target_id=d.id,
        details={"fields": sorted(changes), "title": d.title[:120]},
    )
    ctx.db.commit()
    ctx.db.refresh(d)
    return _out(ctx, [d])[0]


@router.delete("/orgs/{org_id}/decisions/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_decision(decision_id: uuid.UUID, ctx: CanWrite, request: Request) -> None:
    d = _get(ctx, decision_id)
    is_manager = ctx.membership.role in (Role.OWNER, Role.ADMIN)
    if not is_manager and d.created_by_user_id != ctx.user.id:
        raise AppError(status.HTTP_403_FORBIDDEN, "org.forbidden")
    audit.record(
        ctx.db,
        "decision.delete",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="decision",
        target_id=d.id,
        details={"title": d.title[:120]},
    )
    ctx.db.delete(d)
    ctx.db.commit()
