import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.core import HabitCreate, HabitLogResult, HabitLogSet, HabitReport, HabitToday, HabitUpdate
from app.services import habits as svc

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("", response_model=list[HabitToday])
def list_habits(day: date | None = None, include_inactive: bool = False, db: Session = Depends(get_db)):
    return svc.list_habits(db, day, include_inactive)


@router.post("", response_model=HabitToday, status_code=201)
def create_habit(data: HabitCreate, db: Session = Depends(get_db)):
    return svc.create_habit(db, data)


@router.get("/report", response_model=HabitReport)
def report(period: Literal["week", "month"] = "week", anchor: date | None = None, db: Session = Depends(get_db)):
    return svc.report(db, period, anchor)


@router.patch("/{habit_id}", response_model=HabitToday)
def update_habit(habit_id: uuid.UUID, data: HabitUpdate, db: Session = Depends(get_db)):
    return svc.update_habit(db, habit_id, data)


@router.delete("/{habit_id}", status_code=204)
def delete_habit(habit_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_habit(db, habit_id)
    return Response(status_code=204)


@router.put("/{habit_id}/logs/{log_date}", response_model=HabitLogResult)
def set_log(habit_id: uuid.UUID, log_date: date, data: HabitLogSet, db: Session = Depends(get_db)):
    habit, rewards = svc.set_log(db, habit_id, log_date, data.count)
    return HabitLogResult(habit=habit, rewards=rewards if rewards and not rewards.is_empty else None)
