import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.permissions import Role
from app.core.security import PASSWORD_MAX_LENGTH

LocaleField = Literal["fr", "en"]
Password = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    country_code: str = Field(pattern=r"^[A-Z]{2}$", examples=["CM", "FR", "SN"])
    currency: str = Field(pattern=r"^[A-Z]{3}$", examples=["XAF", "EUR", "XOF"])
    default_locale: LocaleField = "fr"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Password
    full_name: str = Field(min_length=1, max_length=200)
    locale: LocaleField = "fr"
    # Optional: people joining through an invitation do not create their own organization.
    organization: OrganizationCreate | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Password


class TokenRequest(BaseModel):
    token: str = Field(min_length=16, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(TokenRequest):
    password: str = Password


class ChangePasswordRequest(BaseModel):
    current_password: str = Password
    new_password: str = Password


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    locale: LocaleField
    email_verified: bool


class OrganizationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str


class MembershipOut(BaseModel):
    organization: OrganizationSummary
    role: Role


class MeOut(BaseModel):
    user: UserOut
    memberships: list[MembershipOut]


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    locale: LocaleField | None = None


class SessionOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    ip: str | None
    user_agent: str | None
    current: bool
