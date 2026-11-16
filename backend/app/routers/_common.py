from typing import TypeVar

from pydantic import BaseModel

from app.schemas.common import Rewards

T = TypeVar("T", bound=BaseModel)


def attach_rewards(model_cls: type[T], source: object, rewards: Rewards | None) -> T:
    """Build a '...WithRewards' response from an ORM object or schema. Empty rewards are omitted."""
    if isinstance(source, BaseModel):
        out = model_cls.model_validate(source.model_dump())
    else:
        out = model_cls.model_validate(source)
    out.rewards = rewards if rewards is not None and not rewards.is_empty else None  # type: ignore[attr-defined]
    return out
