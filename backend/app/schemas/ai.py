import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class AIStatus(BaseModel):
    provider: str = "groq"
    configured: bool  # a Groq API key is present on the server
    enabled: bool  # configured AND she has not switched AI off in settings
    model: str | None
    reason: str | None = None


class PlanRequest(BaseModel):
    start_date: date | None = None
    days: int = Field(default=7, ge=1, le=14)
    daily_minutes: int | None = Field(default=None, ge=30, le=720)
    topic_ids: list[uuid.UUID] | None = None
    notes: str | None = Field(default=None, max_length=600)


class PlanBlock(BaseModel):
    topic_id: uuid.UUID
    title: str
    subject: str | None
    minutes: int
    focus: str | None = None


class PlanDay(BaseModel):
    date: date
    total_minutes: int
    tip: str | None = None
    blocks: list[PlanBlock]


class PlanUnscheduled(BaseModel):
    topic_id: uuid.UUID
    title: str
    reason: str


class StudyPlan(BaseModel):
    source: Literal["ai", "fallback"]
    summary: str
    days: list[PlanDay]
    unscheduled: list[PlanUnscheduled]
    warnings: list[str]
    attempts: int
    daily_minutes: int


class ApplyAssignment(BaseModel):
    topic_id: uuid.UUID
    date: date


class ApplyPlanRequest(BaseModel):
    assignments: list[ApplyAssignment] = Field(min_length=1)


class ApplyPlanResult(BaseModel):
    updated: int


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AssistantRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    topic_id: uuid.UUID | None = None


class AssistantReply(BaseModel):
    reply: str


class WeeklySummary(BaseModel):
    summary: str
    week_start: date
    week_end: date
    stats: dict


class MotivationRequest(BaseModel):
    focus: str | None = Field(default=None, max_length=120)


class MotivationReply(BaseModel):
    message: str


class ReflectRequest(BaseModel):
    source: Literal["mood", "journal", "reflection"]
    id: uuid.UUID


class ReflectReply(BaseModel):
    reflection: str
