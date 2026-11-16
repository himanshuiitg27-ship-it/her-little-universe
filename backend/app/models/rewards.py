"""Achievements, garden, surprises, calendar, reminders."""

import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    false,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Achievement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An unlocked badge. Badge definitions live in code (services/achievements.py)."""

    __tablename__ = "achievements"

    key: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    unlocked_on: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (Index("ix_achievements_unlocked_on", "unlocked_on"),)


class GardenProgress(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Single-row table with the garden's total experience points and level."""

    __tablename__ = "garden_progress"

    total_xp: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    level: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class GardenItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A flower, plant or decoration that has been unlocked. Catalog lives in code."""

    __tablename__ = "garden_items"

    item_key: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    slot: Mapped[int] = mapped_column(Integer, nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class XpEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Ledger of XP awards. The unique key makes every award idempotent (no double XP)."""

    __tablename__ = "xp_events"

    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_key: Mapped[str] = mapped_column(String(80), nullable=False)
    xp: Mapped[int] = mapped_column(Integer, nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        UniqueConstraint("event_type", "source_key", name="uq_xp_events_type_source"),
        Index("ix_xp_events_event_date", "event_date"),
    )


class Surprise(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "surprises"

    kind: Mapped[str] = mapped_column(String(15), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    emoji: Mapped[str | None] = mapped_column(String(16))
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    times_shown: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_shown_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "kind IN ('motivation','compliment','hug','special')", name="ck_surprises_kind"
        ),
        Index("ix_surprises_kind_active", "kind", "is_active"),
    )


class CalendarEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "calendar_events"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    event_type: Mapped[str] = mapped_column(String(15), default="other", server_default="other")
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('exam','deadline','study','goal','personal','other')",
            name="ck_calendar_events_type",
        ),
        Index("ix_calendar_events_event_date", "event_date"),
    )


class Reminder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Recurring (days_of_week, 0=Mon..6=Sun) or one-off (remind_date) reminders."""

    __tablename__ = "reminders"

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(10), default="custom", server_default="custom")
    remind_time: Mapped[time] = mapped_column(Time, nullable=False)
    days_of_week: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    remind_date: Mapped[date | None] = mapped_column(Date)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("calendar_events.id", ondelete="CASCADE")
    )

    __table_args__ = (
        CheckConstraint("kind IN ('sleep','study','habit','event','custom')", name="ck_reminders_kind"),
        Index("ix_reminders_is_enabled", "is_enabled"),
        Index("ix_reminders_event_id", "event_id"),
    )
