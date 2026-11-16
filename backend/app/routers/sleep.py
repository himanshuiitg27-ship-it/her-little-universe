import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers._common import attach_rewards
from app.schemas.study import SleepAnalytics, SleepCreate, SleepOut, SleepUpdate, SleepWithRewards
from app.services import sleep as svc

router = APIRouter(prefix="/sleep", tags=["sleep"])


@router.get("", response_model=list[SleepOut])
def list_records(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)):
    return svc.list_records(db, start, end)


@router.post("", response_model=SleepWithRewards, status_code=201)
def create_record(data: SleepCreate, db: Session = Depends(get_db)):
    record, rewards = svc.create_record(db, data)
    return attach_rewards(SleepWithRewards, record, rewards)


@router.patch("/{record_id}", response_model=SleepOut)
def update_record(record_id: uuid.UUID, data: SleepUpdate, db: Session = Depends(get_db)):
    return svc.update_record(db, record_id, data)


@router.delete("/{record_id}", status_code=204)
def delete_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_record(db, record_id)
    return Response(status_code=204)


@router.get("/analytics", response_model=SleepAnalytics)
def analytics(period: Literal["week", "month"] = "week", anchor: date | None = None, db: Session = Depends(get_db)):
    return svc.analytics(db, period, anchor)
