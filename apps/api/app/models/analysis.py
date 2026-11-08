"""Analysis jobs and pre-analysis follow-up questions. Tenant data, protected by RLS."""

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Timestamps, UUIDPrimaryKey, utcnow
from app.db.session import Base


class AnalysisStatus(StrEnum):
    COLLECTING_INFO = "collecting_info"  # waiting for answers to follow-up questions
    PENDING = "pending"  # queued
    ANALYZING = "analyzing"
    SIMULATING = "simulating"
    VERIFYING = "verifying"
    REPORTING = "reporting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


ACTIVE = (
    AnalysisStatus.COLLECTING_INFO,
    AnalysisStatus.PENDING,
    AnalysisStatus.ANALYZING,
    AnalysisStatus.SIMULATING,
    AnalysisStatus.VERIFYING,
    AnalysisStatus.REPORTING,
)
RUNNING = (
    AnalysisStatus.ANALYZING,
    AnalysisStatus.SIMULATING,
    AnalysisStatus.VERIFYING,
    AnalysisStatus.REPORTING,
)


class Analysis(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "analyses"
    __table_args__ = (
        Index("ix_analyses_org_created", "organization_id", "created_at"),
        Index("ix_analyses_queue", "status", "next_attempt_at"),
        # At most one active analysis per decision.
        Index(
            "uq_analyses_active_decision",
            "decision_id",
            unique=True,
            postgresql_where=text(
                "status IN ('collecting_info','pending','analyzing',"
                "'simulating','verifying','reporting')"
            ),
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    decision_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("decisions.id", ondelete="CASCADE"))
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(
            AnalysisStatus,
            native_enum=False,
            length=24,
            values_callable=lambda e: [m.value for m in e],
        )
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locked_by: Mapped[str | None] = mapped_column(String(64))
    waiting_reason: Mapped[str | None] = mapped_column(String(64))
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    quota_period: Mapped[date] = mapped_column(Date)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DecisionQuestion(UUIDPrimaryKey, Base):
    __tablename__ = "decision_questions"
    __table_args__ = (UniqueConstraint("analysis_id", "key"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    decision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decisions.id", ondelete="CASCADE"), index=True
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(32))
    position: Mapped[int] = mapped_column(Integer)
    answer: Mapped[str | None] = mapped_column(Text)
    unknown: Mapped[bool] = mapped_column(Boolean, default=False)
    answered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
