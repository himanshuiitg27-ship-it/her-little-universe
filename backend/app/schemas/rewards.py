"""Schemas for garden, surprises, achievements, calendar, reminders."""

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import ORMModel, Timestamped

# ---------------------------------------------------------------- garden


class GardenCatalogItem(BaseModel):
    key: str
    name: str
    emoji: str
    kind: str
    unlock_xp: int
    unlocked: bool
    slot: int | None = None
    unlocked_at: datetime | None = None


class XpEventOut(ORMModel):
    event_type: str
    xp: int
    event_date: date
    created_at: datetime
    label: str = ""


class GardenOut(BaseModel):
    total_xp: int
    level: int
    xp_into_level: int
    xp_for_next_level: int
    progress_pct: int
    unlocked_count: int
    total_count: int
    next_unlock: GardenCatalogItem | None
    items: list[GardenCatalogItem]
    recent_events: list[XpEventOut]
    xp_today: int


# ---------------------------------------------------------------- surprises

SurpriseKind = Literal["motivation", "compliment", "hug", "special"]


class SurpriseCreate(BaseModel):
    kind: SurpriseKind = "special"
    content: str = Field(min_length=1, max_length=1000)
    emoji: str | None = Field(default=None, max_length=16)

    @field_validator("content")
    @classmethod
    def strip(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        return v


class SurpriseUpdate(BaseModel):
    kind: SurpriseKind | None = None
    content: str | None = Field(default=None, min_length=1, max_length=1000)
    emoji: str | None = Field(default=None, max_length=16)
    is_active: bool | None = None


class SurpriseOut(Timestamped):
    kind: str
    content: str
    emoji: str | None
    is_custom: bool
    is_active: bool
    times_shown: int
    last_shown_at: datetime | None


# ---------------------------------------------------------------- achievements


class AchievementOut(BaseModel):
    key: str
    title: str
    description: str
    category: str
    icon: str
    threshold: int
    value: int
    progress_pct: int
    unlocked: bool
    unlocked_at: datetime | None


class AchievementList(BaseModel):
    unlocked_count: int
    total_count: int
    today: list[AchievementOut]
    this_week: list[AchievementOut]
    achievements: list[AchievementOut]


class MonthlySummary(BaseModel):
    month: str  # YYYY-MM
    start: date
    end: date
    study_minutes: int
    study_days: int
    topics_completed: int
    goals_completed: int
    goals_total: int
    habit_completion_pct: int
    average_sleep_minutes: int | None
    average_mood_score: float | None
    journal_entries: int
    reflections: int
    xp_earned: int
    badges_earned: list[AchievementOut]


# ---------------------------------------------------------------- calendar

EventType = Literal["exam", "deadline", "study", "goal", "personal", "other"]


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    event_type: EventType = "other"
    event_date: date
    start_time: time | None = None
    end_time: time | None = None

    @model_validator(mode="after")
    def check_times(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        return self


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    event_type: EventType | None = None
    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    is_completed: bool | None = None


class EventOut(Timestamped):
    title: str
    description: str | None
    event_type: str
    event_date: date
    start_time: time | None
    end_time: time | None
    is_completed: bool


class CalendarItem(BaseModel):
    """Unified calendar entry: either a stored event or one derived from study topics."""

    id: str
    source: Literal["event", "topic_deadline", "topic_planned"]
    title: str
    item_type: str
    date: date
    start_time: time | None = None
    end_time: time | None = None
    description: str | None = None
    is_completed: bool = False
    editable: bool = False


class CalendarMonth(BaseModel):
    year: int
    month: int
    start: date
    end: date
    items: list[CalendarItem]


# ---------------------------------------------------------------- reminders

ReminderKind = Literal["sleep", "study", "habit", "event", "custom"]


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    message: str | None = Field(default=None, max_length=1000)
    kind: ReminderKind = "custom"
    remind_time: time
    days_of_week: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    remind_date: date | None = None
    is_enabled: bool = True
    event_id: uuid.UUID | None = None

    @field_validator("days_of_week")
    @classmethod
    def check_days(cls, v):
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("days_of_week values must be between 0 (Mon) and 6 (Sun)")
        return sorted(set(v))

    @model_validator(mode="after")
    def check_schedule(self):
        if not self.days_of_week and not self.remind_date:
            raise ValueError("Pick at least one weekday or a specific date")
        return self


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    message: str | None = Field(default=None, max_length=1000)
    kind: ReminderKind | None = None
    remind_time: time | None = None
    days_of_week: list[int] | None = None
    remind_date: date | None = None
    is_enabled: bool | None = None

    @field_validator("days_of_week")
    @classmethod
    def check_days(cls, v):
        if v is None:
            return v
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("days_of_week values must be between 0 (Mon) and 6 (Sun)")
        return sorted(set(v))


class ReminderOut(Timestamped):
    title: str
    message: str | None
    kind: str
    remind_time: time
    days_of_week: list[int]
    remind_date: date | None
    is_enabled: bool
    event_id: uuid.UUID | None
