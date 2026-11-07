from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class RateLimit(Base):
    """Fixed-window counter. Written with raw SQL in app.core.ratelimit; mapped for Alembic."""

    __tablename__ = "rate_limits"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
