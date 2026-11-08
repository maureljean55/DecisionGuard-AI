"""Business decisions submitted by an organisation. Tenant data, protected by RLS."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Timestamps, UUIDPrimaryKey
from app.db.session import Base


class DecisionCategory(StrEnum):
    STRATEGIC = "strategic"
    FINANCIAL = "financial"
    OPERATIONAL = "operational"
    TECHNOLOGICAL = "technological"
    ORGANIZATIONAL = "organizational"
    COMMERCIAL = "commercial"
    LEGAL = "legal"


class DecisionStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"  # waiting for analysis
    ARCHIVED = "archived"


def _enum(e: type[StrEnum], length: int) -> Enum:
    return Enum(e, native_enum=False, length=length, values_callable=lambda x: [m.value for m in x])


class Decision(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "decisions"
    __table_args__ = (Index("ix_decisions_org_updated", "organization_id", "updated_at"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    context: Mapped[str | None] = mapped_column(Text)
    category: Mapped[DecisionCategory] = mapped_column(_enum(DecisionCategory, 32))
    status: Mapped[DecisionStatus] = mapped_column(_enum(DecisionStatus, 16))
    amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str | None] = mapped_column(String(3))
    deadline: Mapped[date | None] = mapped_column(Date)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
