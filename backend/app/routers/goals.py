import uuid
from datetime import date

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers._common import attach_rewards
from app.schemas.core import GoalCreate, GoalOut, GoalUpdate, GoalWithRewards
from app.services import goals as svc

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
def list_goals(goal_date: date | None = None, db: Session = Depends(get_db)):
    return svc.list_goals(db, goal_date)


@router.post("", response_model=GoalOut, status_code=201)
def create_goal(data: GoalCreate, db: Session = Depends(get_db)):
    return svc.create_goal(db, data)


@router.patch("/{goal_id}", response_model=GoalWithRewards)
def update_goal(goal_id: uuid.UUID, data: GoalUpdate, db: Session = Depends(get_db)):
    goal, rewards = svc.update_goal(db, goal_id, data)
    return attach_rewards(GoalWithRewards, goal, rewards)


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_goal(db, goal_id)
    return Response(status_code=204)
