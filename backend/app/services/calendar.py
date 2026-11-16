import uuid
from datetime import date, time, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationFailed
from app.models import CalendarEvent, StudyTopic
from app.schemas.rewards import CalendarItem, CalendarMonth, EventCreate, EventUpdate
from app.services import dates


def get_event(db: Session, event_id: uuid.UUID) -> CalendarEvent:
    event = db.get(CalendarEvent, event_id)
    if event is None:
        raise NotFoundError("Event not found")
    return event


def create_event(db: Session, data: EventCreate) -> CalendarEvent:
    event = CalendarEvent(**data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def update_event(db: Session, event_id: uuid.UUID, data: EventUpdate) -> CalendarEvent:
    event = get_event(db, event_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None and key in ("title", "event_type", "event_date", "is_completed"):
            continue
        setattr(event, key, value)
    if event.start_time and event.end_time and event.end_time <= event.start_time:
        raise ValidationFailed("End time must be after start time")
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event_id: uuid.UUID) -> None:
    db.delete(get_event(db, event_id))
    db.commit()


def items_between(db: Session, start: date, end: date) -> list[CalendarItem]:
    """Stored events plus study deadlines/plans derived from topics, as one sorted list."""
    items: list[CalendarItem] = []
    for e in db.scalars(
        select(CalendarEvent).where(CalendarEvent.event_date.between(start, end)).order_by(CalendarEvent.event_date)
    ).all():
        items.append(
            CalendarItem(
                id=str(e.id),
                source="event",
                title=e.title,
                item_type=e.event_type,
                date=e.event_date,
                start_time=e.start_time,
                end_time=e.end_time,
                description=e.description,
                is_completed=e.is_completed,
                editable=True,
            )
        )
    topics = db.scalars(
        select(StudyTopic).where(
            or_(StudyTopic.deadline.between(start, end), StudyTopic.planned_date.between(start, end))
        )
    ).all()
    for t in topics:
        if t.deadline and start <= t.deadline <= end:
            items.append(
                CalendarItem(
                    id=f"deadline:{t.id}",
                    source="topic_deadline",
                    title=f"Due: {t.title}",
                    item_type="deadline",
                    date=t.deadline,
                    is_completed=t.is_completed,
                )
            )
        if t.planned_date and start <= t.planned_date <= end:
            items.append(
                CalendarItem(
                    id=f"planned:{t.id}",
                    source="topic_planned",
                    title=f"Study: {t.title}",
                    item_type="study",
                    date=t.planned_date,
                    is_completed=t.is_completed,
                )
            )
    items.sort(key=lambda i: (i.date, i.start_time is None, i.start_time or time.min, i.title))
    return items


def month_view(db: Session, year: int, month: int) -> CalendarMonth:
    try:
        start = date(year, month, 1)
    except ValueError as exc:
        raise ValidationFailed("Invalid year or month") from exc
    start, end = dates.month_bounds(start)
    return CalendarMonth(year=year, month=month, start=start, end=end, items=items_between(db, start, end))


def upcoming(db: Session, days: int = 30) -> list[CalendarItem]:
    start = dates.today()
    items = items_between(db, start, start + timedelta(days=days))
    return [i for i in items if not i.is_completed]
