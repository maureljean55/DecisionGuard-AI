import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.permissions import Role


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    country_code: str
    currency: str
    default_locale: Literal["fr", "en"]
    plan: str
    created_at: datetime


class OrganizationWithRole(OrganizationOut):
    role: Role


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    country_code: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    default_locale: Literal["fr", "en"] | None = None


class MemberOut(BaseModel):
    id: uuid.UUID  # membership id
    user_id: uuid.UUID
    email: str
    full_name: str
    role: Role
    joined_at: datetime


class RoleUpdate(BaseModel):
    role: Role


class InvitationCreate(BaseModel):
    email: EmailStr
    role: Role = Role.ANALYST


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: Role
    created_at: datetime
    expires_at: datetime


class InvitationPreview(BaseModel):
    organization_name: str
    email: str
    role: Role


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    actor_user_id: uuid.UUID | None
    actor_name: str | None = None
    actor_email: str | None = None
    target_type: str | None
    target_id: str | None
    ip: Any | None
    details: dict[str, Any]
    created_at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditLogOut]
    next_before_id: int | None
