import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.core import HabitToday, MoodOut
from app.schemas.rewards import CalendarItem
from app.schemas.study import TopicOut


class DashStudy(BaseModel):
    today_minutes: int
    goal_minutes: int
    goal_pct: int
    sessions_today: int


class DashSleep(BaseModel):
    last_duration_minutes: int | None
    last_sleep_date: date | None
    last_bedtime: datetime | None
    last_wake_time: datetime | None
    goal_minutes: int
    goal_pct: int | None


class DashTasks(BaseModel):
    completed_today: int
    pending: int
    items: list[TopicOut]  # pending topics that are planned, due or overdue (most urgent first)


class DashGoal(BaseModel):
    id: uuid.UUID
    title: str
    is_completed: bool
    category: str | None


class DashGoals(BaseModel):
    total: int
    completed: int
    pct: int
    items: list[DashGoal]


class DashHabits(BaseModel):
    total: int
    completed: int
    pct: int
    items: list[HabitToday]


class DashWeekDay(BaseModel):
    date: date
    weekday: str
    study_minutes: int
    goals_completed: int
    goals_total: int
    habits_completed: int
    sleep_minutes: int | None
    is_today: bool
    is_future: bool


class DashGarden(BaseModel):
    level: int
    total_xp: int
    xp_into_level: int
    xp_for_next_level: int
    progress_pct: int
    xp_today: int
    unlocked_count: int


class DashMessage(BaseModel):
    id: uuid.UUID
    kind: str
    content: str
    emoji: str | None


class Dashboard(BaseModel):
    date: date
    display_name: str
    part_of_day: str
    study: DashStudy
    sleep: DashSleep
    tasks: DashTasks
    goals: DashGoals
    habits: DashHabits
    mood_today: MoodOut | None
    reflection_done_today: bool
    week: list[DashWeekDay]
    garden: DashGarden
    message: DashMessage | None
    upcoming: list[CalendarItem]
    carry_forward_count: int
    ai_available: bool
