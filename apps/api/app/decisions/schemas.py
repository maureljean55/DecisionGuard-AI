import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.decision import DecisionCategory, DecisionStatus

Amount = Field(default=None, ge=0, le=Decimal("1e15"), max_digits=18, decimal_places=2)


class DecisionCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=5000)
    category: DecisionCategory
    context: str | None = Field(default=None, max_length=5000)
    amount: Decimal | None = Amount
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    deadline: date | None = None
    # True: submit for analysis right away; False: keep as a draft.
    submit: bool = False


class DecisionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=10, max_length=5000)
    category: DecisionCategory | None = None
    context: str | None = Field(default=None, max_length=5000)
    amount: Decimal | None = Amount
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    deadline: date | None = None
    status: Literal["draft", "submitted", "archived"] | None = None


class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    context: str | None
    category: DecisionCategory
    status: DecisionStatus
    amount: Decimal | None
    currency: str | None
    deadline: date | None
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    created_by_user_id: uuid.UUID | None
    created_by_name: str | None = None
