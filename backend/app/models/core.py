"""Settings, goals, habits, mood, journal."""

import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    false,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AppSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Single-row table holding personal preferences (no user accounts in this app)."""

    __tablename__ = "app_settings"

    display_name: Mapped[str] = mapped_column(String(60), default="", server_default="")
    daily_study_goal_minutes: Mapped[int] = mapped_column(Integer, default=240, server_default="240")
    sleep_goal_minutes: Mapped[int] = mapped_column(Integer, default=480, server_default="480")
    target_bedtime: Mapped[time] = mapped_column(Time, default=time(23, 0))
    target_wake_time: Mapped[time] = mapped_column(Time, default=time(7, 0))
    theme: Mapped[str] = mapped_column(String(10), default="light", server_default="light")
    pomodoro_focus_minutes: Mapped[int] = mapped_column(Integer, default=25, server_default="25")
    pomodoro_break_minutes: Mapped[int] = mapped_column(Integer, default=5, server_default="5")
    pomodoro_long_break_minutes: Mapped[int] = mapped_column(Integer, default=15, server_default="15")
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    seeded: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    __table_args__ = (CheckConstraint("theme IN ('light','dark')", name="ck_app_settings_theme"),)


class DailyGoal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "daily_goals"

    goal_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str | None] = mapped_column(String(40))
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    __table_args__ = (Index("ix_daily_goals_goal_date", "goal_date"),)


class Habit(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "habits"

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    emoji: Mapped[str] = mapped_column(String(16), default="🌸", server_default="🌸")
    category: Mapped[str | None] = mapped_column(String(40))  # exercise | reading | hydration | revision | custom
    target_count: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    unit: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    logs: Mapped[list["HabitLog"]] = relationship(
        back_populates="habit", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (CheckConstraint("target_count >= 1", name="ck_habits_target_positive"),)


class HabitLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "habit_logs"

    habit_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("habits.id", ondelete="CASCADE"), nullable=False
    )
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    habit: Mapped[Habit] = relationship(back_populates="logs")

    __table_args__ = (
        UniqueConstraint("habit_id", "log_date", name="uq_habit_logs_habit_date"),
        Index("ix_habit_logs_log_date", "log_date"),
        CheckConstraint("count >= 0", name="ck_habit_logs_count_nonneg"),
    )


class MoodEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mood_entries"

    entry_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    mood: Mapped[str] = mapped_column(String(20), nullable=False)
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1 (low) .. 5 (high)
    note: Mapped[str | None] = mapped_column(Text)
    ai_reflection: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (CheckConstraint("score BETWEEN 1 AND 5", name="ck_mood_entries_score_range"),)


class JournalEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Free-form journal entries (kind='journal') and structured night reflections (kind='reflection')."""

    __tablename__ = "journal_entries"

    kind: Mapped[str] = mapped_column(String(12), default="journal", server_default="journal")
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str | None] = mapped_column(String(160))
    content: Mapped[str | None] = mapped_column(Text)
    happy_moment: Mapped[str | None] = mapped_column(Text)
    accomplishment: Mapped[str | None] = mapped_column(Text)
    improvement: Mapped[str | None] = mapped_column(Text)
    gratitude: Mapped[str | None] = mapped_column(Text)
    ai_reflection: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_journal_entries_kind_date", "kind", "entry_date"),
        CheckConstraint("kind IN ('journal','reflection')", name="ck_journal_entries_kind"),
    )
