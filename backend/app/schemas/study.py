"""Schemas for study topics/sessions, sleep."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import ORMModel, Timestamped, WithRewards

Priority = Literal["low", "medium", "high"]

# ---------------------------------------------------------------- topics


class TopicCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=4000)
    priority: Priority = "medium"
    deadline: date | None = None
    planned_date: date | None = None
    estimated_minutes: int = Field(default=60, ge=5, le=1440)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v


class TopicUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=4000)
    priority: Priority | None = None
    deadline: date | None = None
    planned_date: date | None = None
    estimated_minutes: int | None = Field(default=None, ge=5, le=1440)
    is_completed: bool | None = None


class TopicOut(Timestamped):
    title: str
    subject: str | None
    notes: str | None
    priority: Priority
    deadline: date | None
    planned_date: date | None
    estimated_minutes: int
    is_completed: bool
    completed_at: datetime | None
    actual_minutes: int = 0
    is_overdue: bool = False


class TopicWithRewards(TopicOut, WithRewards):
    pass


class PrioritizedTopic(BaseModel):
    topic: TopicOut
    score: int
    reasons: list[str]


class CarryForwardRequest(BaseModel):
    topic_ids: list[uuid.UUID] = Field(min_length=1)
    target_date: date | None = None  # defaults to today


class CarryForwardResult(BaseModel):
    moved: int
    target_date: date


# ---------------------------------------------------------------- sessions


class SessionCreate(BaseModel):
    topic_id: uuid.UUID | None = None
    duration_minutes: int = Field(ge=1, le=720)
    kind: Literal["pomodoro", "manual"] = "manual"
    session_date: date | None = None
    started_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


class SessionOut(Timestamped):
    topic_id: uuid.UUID | None
    topic_title: str | None = None
    session_date: date
    started_at: datetime | None
    duration_minutes: int
    kind: str
    notes: str | None


class SessionWithRewards(SessionOut, WithRewards):
    pass


class StudyAnalytics(BaseModel):
    period: Literal["day", "week", "month"]
    start: date
    end: date
    total_minutes: int
    sessions_count: int
    active_days: int
    average_minutes_per_active_day: int
    best_day: date | None
    topics_completed: int
    goal_minutes_per_day: int
    days: list[dict]  # [{date, minutes}]
    by_subject: list[dict]  # [{subject, minutes}]


# ---------------------------------------------------------------- sleep


class SleepCreate(BaseModel):
    bedtime: datetime
    wake_time: datetime
    quality: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def check_order(self):
        if self.bedtime.tzinfo is None or self.wake_time.tzinfo is None:
            raise ValueError("bedtime and wake_time must include a timezone offset")
        minutes = (self.wake_time - self.bedtime).total_seconds() / 60
        if minutes <= 0:
            raise ValueError("Wake-up time must be after bedtime")
        if minutes > 20 * 60:
            raise ValueError("Sleep longer than 20 hours looks like a typo - please check the times")
        return self


class SleepUpdate(BaseModel):
    bedtime: datetime | None = None
    wake_time: datetime | None = None
    quality: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=2000)


class SleepOut(Timestamped):
    sleep_date: date
    bedtime: datetime
    wake_time: datetime
    duration_minutes: int
    quality: int | None
    notes: str | None


class SleepWithRewards(SleepOut, WithRewards):
    pass


class SleepAnalytics(BaseModel):
    period: Literal["week", "month"]
    start: date
    end: date
    records_count: int
    average_minutes: int | None
    goal_minutes: int
    goal_met_nights: int
    consistency_score: int | None  # 0..100, None when fewer than 3 records
    consistency_label: str | None
    average_bedtime: str | None  # "HH:MM"
    average_wake_time: str | None
    days: list[dict]  # [{date, minutes, bedtime, wake_time, quality}]
