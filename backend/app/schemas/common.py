import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Timestamped(ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class UnlockedItem(BaseModel):
    key: str
    name: str
    emoji: str
    kind: str


class UnlockedBadge(BaseModel):
    key: str
    title: str
    icon: str
    description: str


class Rewards(BaseModel):
    """Attached to responses of actions that can grow the garden / unlock badges."""

    xp_gained: int = 0
    total_xp: int = 0
    level: int = 1
    leveled_up: bool = False
    new_items: list[UnlockedItem] = []
    new_achievements: list[UnlockedBadge] = []

    @property
    def is_empty(self) -> bool:
        return not (self.xp_gained or self.new_items or self.new_achievements or self.leveled_up)


class WithRewards(BaseModel):
    rewards: Rewards | None = None


class Message(BaseModel):
    message: str
