import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.rewards import ReminderCreate, ReminderOut, ReminderUpdate
from app.services import reminders as svc

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderOut])
def list_reminders(enabled_only: bool = False, db: Session = Depends(get_db)):
    return svc.list_reminders(db, enabled_only)


@router.post("", response_model=ReminderOut, status_code=201)
def create_reminder(data: ReminderCreate, db: Session = Depends(get_db)):
    return svc.create_reminder(db, data)


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(reminder_id: uuid.UUID, data: ReminderUpdate, db: Session = Depends(get_db)):
    return svc.update_reminder(db, reminder_id, data)


@router.delete("/{reminder_id}", status_code=204)
def delete_reminder(reminder_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_reminder(db, reminder_id)
    return Response(status_code=204)
