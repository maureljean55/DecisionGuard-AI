"""Organization access: resolves the caller's membership and enforces permissions.

Non-members always get 404 (never 403), so the existence of other tenants is not revealed.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import DB, CurrentUser
from app.core.errors import AppError, NotFound
from app.core.permissions import Permission, has_permission
from app.db.session import set_rls_context
from app.models import Membership, Organization, User


@dataclass
class OrgContext:
    db: Session
    user: User
    membership: Membership

    @property
    def org(self) -> Organization:
        return self.membership.organization

    @property
    def org_id(self) -> uuid.UUID:
        return self.membership.organization_id


def org_context(org_id: uuid.UUID, user: CurrentUser, db: DB) -> OrgContext:
    set_rls_context(db, user_id=user.id, org_id=org_id)
    membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == org_id, Membership.user_id == user.id
        )
    )
    if membership is None:
        raise NotFound()
    return OrgContext(db=db, user=user, membership=membership)


def require(permission: Permission) -> Callable[..., OrgContext]:
    def dependency(ctx: Annotated[OrgContext, Depends(org_context)]) -> OrgContext:
        if not has_permission(ctx.membership.role, permission):
            raise AppError(status.HTTP_403_FORBIDDEN, "org.forbidden")
        return ctx

    return dependency


Member = Annotated[OrgContext, Depends(org_context)]
