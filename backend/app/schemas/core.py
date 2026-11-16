"""Schemas for settings, goals, habits, mood, journal/reflections."""

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel, Timestamped, WithRewards

# ---------------------------------------------------------------- settings


class SettingsOut(ORMModel):
    display_name: str
    daily_study_goal_minutes: int
    sleep_goal_minutes: int
    target_bedtime: time
    target_wake_time: time
    theme: Literal["light", "dark"]
    pomodoro_focus_minutes: int
    pomodoro_break_minutes: int
    pomodoro_long_break_minutes: int
    ai_enabled: bool


class SettingsUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=60)
    daily_study_goal_minutes: int | None = Field(default=None, ge=15, le=1440)
    sleep_goal_minutes: int | None = Field(default=None, ge=120, le=960)
    target_bedtime: time | None = None
    target_wake_time: time | None = None
    theme: Literal["light", "dark"] | None = None
    pomodoro_focus_minutes: int | None = Field(default=None, ge=5, le=120)
    pomodoro_break_minutes: int | None = Field(default=None, ge=1, le=60)
    pomodoro_long_break_minutes: int | None = Field(default=None, ge=1, le=90)
    ai_enabled: bool | None = None

    @field_validator("display_name")
    @classmethod
    def strip_name(cls, v):
        return v.strip() if v is not None else v


# ---------------------------------------------------------------- goals


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    goal_date: date | None = None  # defaults to today
    category: str | None = Field(default=None, max_length=40)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=40)
    goal_date: date | None = None
    is_completed: bool | None = None


class GoalOut(Timestamped):
    goal_date: date
    title: str
    category: str | None
    is_completed: bool
    completed_at: datetime | None


class GoalWithRewards(GoalOut, WithRewards):
    pass


# ---------------------------------------------------------------- habits


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    emoji: str = Field(default="🌸", min_length=1, max_length=16)
    category: str | None = Field(default="custom", max_length=40)
    target_count: int = Field(default=1, ge=1, le=100)
    unit: str | None = Field(default=None, max_length=30)


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    emoji: str | None = Field(default=None, min_length=1, max_length=16)
    category: str | None = Field(default=None, max_length=40)
    target_count: int | None = Field(default=None, ge=1, le=100)
    unit: str | None = Field(default=None, max_length=30)
    is_active: bool | None = None


class HabitOut(Timestamped):
    name: str
    emoji: str
    category: str | None
    target_count: int
    unit: str | None
    is_active: bool


class HabitToday(HabitOut):
    """A habit decorated with the progress for a particular day."""

    log_date: date
    count: int
    is_done: bool
    current_streak: int
    longest_streak: int
    last_7_days: list[bool]  # oldest -> newest, ends on log_date


class HabitLogSet(BaseModel):
    count: int = Field(ge=0, le=1000)


class HabitLogOut(ORMModel):
    habit_id: uuid.UUID
    log_date: date
    count: int


class HabitLogResult(WithRewards):
    habit: HabitToday


class HabitReportRow(BaseModel):
    habit_id: uuid.UUID
    name: str
    emoji: str
    days_done: int
    days_in_period: int
    completion_pct: int
    current_streak: int
    longest_streak: int


class HabitReport(BaseModel):
    period: Literal["week", "month"]
    start: date
    end: date
    overall_pct: int
    daily: list[dict]  # [{date, done, total}]
    habits: list[HabitReportRow]


# ---------------------------------------------------------------- mood


class MoodOption(BaseModel):
    key: str
    emoji: str
    label: str
    score: int


class MoodSet(BaseModel):
    entry_date: date | None = None
    mood: str = Field(min_length=1, max_length=20)
    note: str | None = Field(default=None, max_length=4000)


class MoodOut(Timestamped):
    entry_date: date
    mood: str
    score: int
    note: str | None
    ai_reflection: str | None
    emoji: str | None = None
    label: str | None = None


class MoodWithRewards(MoodOut, WithRewards):
    pass


class MoodTrend(BaseModel):
    days: int
    average_score: float | None
    entries_count: int
    most_common: str | None
    series: list[dict]  # [{date, score, mood, emoji}]
    distribution: list[dict]  # [{mood, emoji, label, count}]


# ---------------------------------------------------------------- journal & reflections


class JournalCreate(BaseModel):
    entry_date: date | None = None
    title: str | None = Field(default=None, max_length=160)
    content: str = Field(min_length=1, max_length=20000)


class JournalUpdate(BaseModel):
    entry_date: date | None = None
    title: str | None = Field(default=None, max_length=160)
    content: str | None = Field(default=None, min_length=1, max_length=20000)


class JournalOut(Timestamped):
    kind: str
    entry_date: date
    title: str | None
    content: str | None
    happy_moment: str | None
    accomplishment: str | None
    improvement: str | None
    gratitude: str | None
    ai_reflection: str | None


class JournalWithRewards(JournalOut, WithRewards):
    pass


class ReflectionSet(BaseModel):
    happy_moment: str | None = Field(default=None, max_length=4000)
    accomplishment: str | None = Field(default=None, max_length=4000)
    improvement: str | None = Field(default=None, max_length=4000)
    gratitude: str | None = Field(default=None, max_length=4000)

    @field_validator("happy_moment", "accomplishment", "improvement", "gratitude")
    @classmethod
    def blank_to_none(cls, v):
        if v is None:
            return None
        v = v.strip()
        return v or None
