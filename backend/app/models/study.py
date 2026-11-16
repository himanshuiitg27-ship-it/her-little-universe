"""Study topics/sessions and sleep records."""

import uuid
from datetime import date, datetime

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
    Uuid,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class StudyTopic(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "study_topics"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(10), default="medium", server_default="medium")
    deadline: Mapped[date | None] = mapped_column(Date)
    planned_date: Mapped[date | None] = mapped_column(Date)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=60, server_default="60")
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sessions: Mapped[list["StudySession"]] = relationship(back_populates="topic", passive_deletes=True)

    __table_args__ = (
        CheckConstraint("priority IN ('low','medium','high')", name="ck_study_topics_priority"),
        CheckConstraint("estimated_minutes > 0", name="ck_study_topics_estimate_positive"),
        Index("ix_study_topics_deadline", "deadline"),
        Index("ix_study_topics_planned_date", "planned_date"),
        Index("ix_study_topics_is_completed", "is_completed"),
    )


class StudySession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "study_sessions"

    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("study_topics.id", ondelete="SET NULL")
    )
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(12), default="manual", server_default="manual")
    notes: Mapped[str | None] = mapped_column(Text)

    topic: Mapped[StudyTopic | None] = relationship(back_populates="sessions")

    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="ck_study_sessions_duration_positive"),
        CheckConstraint("kind IN ('pomodoro','manual')", name="ck_study_sessions_kind"),
        Index("ix_study_sessions_session_date", "session_date"),
        Index("ix_study_sessions_topic_id", "topic_id"),
    )


class SleepRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One row per night, keyed by the date the person woke up."""

    __tablename__ = "sleep_records"

    sleep_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    bedtime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    wake_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    quality: Mapped[int | None] = mapped_column(SmallInteger)
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="ck_sleep_records_duration_positive"),
        CheckConstraint("quality IS NULL OR quality BETWEEN 1 AND 5", name="ck_sleep_records_quality"),
    )
