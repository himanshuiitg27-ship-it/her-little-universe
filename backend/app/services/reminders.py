import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationFailed
from app.models import CalendarEvent, Reminder
from app.schemas.rewards import ReminderCreate, ReminderUpdate


def get_reminder(db: Session, reminder_id: uuid.UUID) -> Reminder:
    r = db.get(Reminder, reminder_id)
    if r is None:
        raise NotFoundError("Reminder not found")
    return r


def list_reminders(db: Session, enabled_only: bool = False) -> list[Reminder]:
    stmt = select(Reminder).order_by(Reminder.remind_time, Reminder.created_at)
    if enabled_only:
        stmt = stmt.where(Reminder.is_enabled.is_(True))
    return list(db.scalars(stmt).all())


def create_reminder(db: Session, data: ReminderCreate) -> Reminder:
    if data.event_id and db.get(CalendarEvent, data.event_id) is None:
        raise ValidationFailed("The linked calendar event does not exist")
    r = Reminder(**data.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def update_reminder(db: Session, reminder_id: uuid.UUID, data: ReminderUpdate) -> Reminder:
    r = get_reminder(db, reminder_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None and key in ("title", "kind", "remind_time", "days_of_week", "is_enabled"):
            continue
        setattr(r, key, value)
    if not r.days_of_week and not r.remind_date:
        raise ValidationFailed("Pick at least one weekday or a specific date")
    db.commit()
    db.refresh(r)
    return r


def delete_reminder(db: Session, reminder_id: uuid.UUID) -> None:
    db.delete(get_reminder(db, reminder_id))
    db.commit()
