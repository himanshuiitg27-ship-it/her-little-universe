import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import DailyGoal
from app.schemas.common import Rewards
from app.schemas.core import GoalCreate, GoalUpdate
from app.services import dates, garden


def get_goal(db: Session, goal_id: uuid.UUID) -> DailyGoal:
    goal = db.get(DailyGoal, goal_id)
    if goal is None:
        raise NotFoundError("Goal not found")
    return goal


def list_goals(db: Session, goal_date: date | None = None) -> list[DailyGoal]:
    day = goal_date or dates.today()
    return list(
        db.scalars(
            select(DailyGoal).where(DailyGoal.goal_date == day).order_by(DailyGoal.sort_order, DailyGoal.created_at)
        ).all()
    )


def create_goal(db: Session, data: GoalCreate) -> DailyGoal:
    day = data.goal_date or dates.today()
    next_order = db.scalar(select(func.coalesce(func.max(DailyGoal.sort_order), -1)).where(DailyGoal.goal_date == day)) + 1
    goal = DailyGoal(title=data.title, goal_date=day, category=data.category, sort_order=next_order)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def update_goal(db: Session, goal_id: uuid.UUID, data: GoalUpdate) -> tuple[DailyGoal, Rewards | None]:
    goal = get_goal(db, goal_id)
    changes = data.model_dump(exclude_unset=True)
    completing = changes.pop("is_completed", None)
    for key, value in changes.items():
        if key in ("title", "goal_date") and value is None:
            continue
        setattr(goal, key, value)

    rewards = None
    if completing is not None and completing != goal.is_completed:
        goal.is_completed = completing
        goal.completed_at = dates.now() if completing else None
    db.commit()
    db.refresh(goal)

    if goal.is_completed:
        events = [("goal_completed", str(goal.id), goal.goal_date)]
        siblings = list_goals(db, goal.goal_date)
        if len(siblings) >= 2 and all(g.is_completed for g in siblings):
            events.append(("all_goals_bonus", goal.goal_date.isoformat(), goal.goal_date))
        rewards = garden.record_events(db, events)
    return goal, rewards


def delete_goal(db: Session, goal_id: uuid.UUID) -> None:
    db.delete(get_goal(db, goal_id))
    db.commit()
