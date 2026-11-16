import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError, ValidationFailed
from app.models import SleepRecord
from app.schemas.common import Rewards
from app.schemas.study import SleepAnalytics, SleepCreate, SleepUpdate
from app.services import calc, dates, garden
from app.services.settings import get_settings_row


def get_record(db: Session, record_id: uuid.UUID) -> SleepRecord:
    record = db.get(SleepRecord, record_id)
    if record is None:
        raise NotFoundError("Sleep record not found")
    return record


def _normalise(bedtime, wake):
    """Store wall-clock in the app timezone so SQLite and PostgreSQL behave identically."""
    return bedtime.astimezone(dates.app_tz()), wake.astimezone(dates.app_tz())


def create_record(db: Session, data: SleepCreate) -> tuple[SleepRecord, Rewards]:
    bed, wake = _normalise(data.bedtime, data.wake_time)
    sleep_date = wake.date()
    if db.scalar(select(SleepRecord.id).where(SleepRecord.sleep_date == sleep_date)):
        raise ConflictError("You already logged sleep for that morning. Edit that entry instead.")
    record = SleepRecord(
        sleep_date=sleep_date,
        bedtime=bed,
        wake_time=wake,
        duration_minutes=calc.sleep_duration_minutes(bed, wake),
        quality=data.quality,
        notes=data.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    rewards = garden.record_events(db, [("sleep_logged", sleep_date.isoformat(), sleep_date)])
    return record, rewards


def update_record(db: Session, record_id: uuid.UUID, data: SleepUpdate) -> SleepRecord:
    record = get_record(db, record_id)
    changes = data.model_dump(exclude_unset=True)
    bed = changes.get("bedtime") or dates.ensure_aware(record.bedtime)
    wake = changes.get("wake_time") or dates.ensure_aware(record.wake_time)
    if bed.tzinfo is None or wake.tzinfo is None:
        raise ValidationFailed("bedtime and wake_time must include a timezone offset")
    bed, wake = _normalise(bed, wake)
    minutes = calc.sleep_duration_minutes(bed, wake)
    if minutes <= 0:
        raise ValidationFailed("Wake-up time must be after bedtime")
    if minutes > 20 * 60:
        raise ValidationFailed("Sleep longer than 20 hours looks like a typo - please check the times")
    new_date = wake.date()
    if new_date != record.sleep_date and db.scalar(
        select(SleepRecord.id).where(SleepRecord.sleep_date == new_date, SleepRecord.id != record.id)
    ):
        raise ConflictError("You already logged sleep for that morning.")
    record.bedtime, record.wake_time, record.duration_minutes, record.sleep_date = bed, wake, minutes, new_date
    if "quality" in changes:
        record.quality = changes["quality"]
    if "notes" in changes:
        record.notes = changes["notes"]
    db.commit()
    db.refresh(record)
    return record


def delete_record(db: Session, record_id: uuid.UUID) -> None:
    db.delete(get_record(db, record_id))
    db.commit()


def list_records(db: Session, start: date | None = None, end: date | None = None, limit: int = 120) -> list[SleepRecord]:
    stmt = select(SleepRecord).order_by(SleepRecord.sleep_date.desc()).limit(limit)
    if start:
        stmt = stmt.where(SleepRecord.sleep_date >= start)
    if end:
        stmt = stmt.where(SleepRecord.sleep_date <= end)
    return list(db.scalars(stmt).all())


def analytics(db: Session, period: str, anchor: date | None = None) -> SleepAnalytics:
    anchor = anchor or dates.today()
    start, end = dates.week_bounds(anchor) if period == "week" else dates.month_bounds(anchor)
    records = list(
        db.scalars(
            select(SleepRecord).where(SleepRecord.sleep_date.between(start, end)).order_by(SleepRecord.sleep_date)
        ).all()
    )
    goal = get_settings_row(db).sleep_goal_minutes
    by_date = {r.sleep_date: r for r in records}

    def fmt(dt):
        return dates.to_local(dt).strftime("%H:%M")

    days = []
    for d in dates.date_range(start, end):
        r = by_date.get(d)
        days.append(
            {
                "date": d.isoformat(),
                "minutes": r.duration_minutes if r else None,
                "bedtime": fmt(r.bedtime) if r else None,
                "wake_time": fmt(r.wake_time) if r else None,
                "quality": r.quality if r else None,
            }
        )
    consistency = calc.sleep_consistency([(r.bedtime, r.wake_time) for r in records])
    return SleepAnalytics(
        period=period,
        start=start,
        end=end,
        records_count=len(records),
        average_minutes=int(sum(r.duration_minutes for r in records) / len(records)) if records else None,
        goal_minutes=goal,
        goal_met_nights=sum(1 for r in records if r.duration_minutes >= goal),
        consistency_score=consistency["score"],
        consistency_label=consistency["label"],
        average_bedtime=consistency["avg_bedtime"],
        average_wake_time=consistency["avg_wake"],
        days=days,
    )
