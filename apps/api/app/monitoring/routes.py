"""Monitoring settings per decision, and mitigation actions with owner, due date and status."""

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.core import audit
from app.core.errors import AppError, NotFound
from app.core.permissions import Permission
from app.db.base import utcnow
from app.models import Decision, Finding, Membership, MitigationAction, User
from app.orgs.deps import OrgContext, require

router = APIRouter(tags=["monitoring"])

CanRead = Annotated[OrgContext, Depends(require(Permission.DECISIONS_READ))]
CanWrite = Annotated[OrgContext, Depends(require(Permission.DECISIONS_WRITE))]
Status = Literal["todo", "in_progress", "done"]


class MonitoringIn(BaseModel):
    every_days: Literal[30, 90] | None


class ActionIn(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    finding_id: uuid.UUID | None = None
    owner_user_id: uuid.UUID | None = None
    due_date: date | None = None


class ActionPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=300)
    status: Status | None = None
    owner_user_id: uuid.UUID | None = None
    due_date: date | None = None
    clear_owner: bool = False
    clear_due_date: bool = False


class ActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    decision_id: uuid.UUID
    decision_title: str | None = None
    finding_id: uuid.UUID | None
    title: str
    owner_user_id: uuid.UUID | None
    owner_name: str | None = None
    due_date: date | None
    status: Status
    done_at: datetime | None
    created_at: datetime


def _meta(request: Request) -> audit.RequestMeta:
    return audit.RequestMeta.from_request(request)


def _decision(ctx: OrgContext, decision_id: uuid.UUID) -> Decision:
    d = ctx.db.scalar(
        select(Decision).where(Decision.id == decision_id, Decision.organization_id == ctx.org_id)
    )
    if d is None:
        raise NotFound()
    return d


def _action(ctx: OrgContext, action_id: uuid.UUID) -> MitigationAction:
    a = ctx.db.scalar(
        select(MitigationAction).where(
            MitigationAction.id == action_id, MitigationAction.organization_id == ctx.org_id
        )
    )
    if a is None:
        raise NotFound()
    return a


def _check_owner(ctx: OrgContext, user_id: uuid.UUID | None) -> None:
    if user_id is None:
        return
    member = ctx.db.scalar(
        select(Membership.id).where(
            Membership.organization_id == ctx.org_id, Membership.user_id == user_id
        )
    )
    if member is None:
        raise AppError(status.HTTP_422_UNPROCESSABLE_CONTENT, "action.owner_not_member")


def _out(ctx: OrgContext, rows: list[MitigationAction]) -> list[ActionOut]:
    titles = (
        dict(
            ctx.db.execute(
                select(Decision.id, Decision.title).where(
                    Decision.id.in_({r.decision_id for r in rows})
                )
            ).all()
        )
        if rows
        else {}
    )
    owners = {r.owner_user_id for r in rows if r.owner_user_id}
    names = (
        dict(ctx.db.execute(select(User.id, User.full_name).where(User.id.in_(owners))).all())
        if owners
        else {}
    )
    out = []
    for r in rows:
        item = ActionOut.model_validate(r)
        item.decision_title = titles.get(r.decision_id)
        item.owner_name = names.get(r.owner_user_id) if r.owner_user_id else None
        out.append(item)
    return out


@router.put("/orgs/{org_id}/decisions/{decision_id}/monitoring")
def set_monitoring(decision_id: uuid.UUID, body: MonitoringIn, ctx: CanWrite, request: Request):
    """Turn periodic re-analysis on (every 30 or 90 days) or off."""
    d = _decision(ctx, decision_id)
    d.monitor_every_days = body.every_days
    audit.record(
        ctx.db,
        "decision.monitoring",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="decision",
        target_id=d.id,
        details={"title": d.title[:120], "every_days": body.every_days},
    )
    ctx.db.commit()
    return {"monitor_every_days": d.monitor_every_days}


@router.get("/orgs/{org_id}/actions", response_model=list[ActionOut])
def list_actions(ctx: CanRead, decision_id: uuid.UUID | None = None):
    q = select(MitigationAction).where(MitigationAction.organization_id == ctx.org_id)
    if decision_id:
        q = q.where(MitigationAction.decision_id == decision_id)
    rows = list(ctx.db.scalars(q.order_by(MitigationAction.created_at.desc()).limit(500)))
    return _out(ctx, rows)


@router.post(
    "/orgs/{org_id}/decisions/{decision_id}/actions",
    response_model=ActionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_action(decision_id: uuid.UUID, body: ActionIn, ctx: CanWrite, request: Request):
    d = _decision(ctx, decision_id)
    if body.finding_id is not None:
        f = ctx.db.get(Finding, body.finding_id)
        if f is None or f.organization_id != ctx.org_id:
            raise NotFound()
    _check_owner(ctx, body.owner_user_id)
    a = MitigationAction(
        organization_id=ctx.org_id,
        decision_id=d.id,
        finding_id=body.finding_id,
        title=body.title.strip(),
        owner_user_id=body.owner_user_id,
        due_date=body.due_date,
        status="todo",
        created_by_user_id=ctx.user.id,
    )
    ctx.db.add(a)
    ctx.db.flush()
    audit.record(
        ctx.db,
        "action.create",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="decision",
        target_id=d.id,
        details={"title": a.title[:120]},
    )
    ctx.db.commit()
    return _out(ctx, [a])[0]


@router.patch("/orgs/{org_id}/actions/{action_id}", response_model=ActionOut)
def update_action(action_id: uuid.UUID, body: ActionPatch, ctx: CanWrite, request: Request):
    a = _action(ctx, action_id)
    if body.title is not None:
        a.title = body.title.strip()
    if body.owner_user_id is not None:
        _check_owner(ctx, body.owner_user_id)
        a.owner_user_id = body.owner_user_id
    if body.clear_owner:
        a.owner_user_id = None
    if body.due_date is not None:
        a.due_date = body.due_date
    if body.clear_due_date:
        a.due_date = None
    if body.status is not None and body.status != a.status:
        a.status = body.status
        a.done_at = utcnow() if body.status == "done" else None
        audit.record(
            ctx.db,
            "action.status",
            _meta(request),
            org_id=ctx.org_id,
            actor_id=ctx.user.id,
            target_type="decision",
            target_id=a.decision_id,
            details={"title": a.title[:120], "status": body.status},
        )
    ctx.db.commit()
    return _out(ctx, [a])[0]


@router.delete("/orgs/{org_id}/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action(action_id: uuid.UUID, ctx: CanWrite, request: Request):
    a = _action(ctx, action_id)
    audit.record(
        ctx.db,
        "action.delete",
        _meta(request),
        org_id=ctx.org_id,
        actor_id=ctx.user.id,
        target_type="decision",
        target_id=a.decision_id,
        details={"title": a.title[:120]},
    )
    ctx.db.delete(a)
    ctx.db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
