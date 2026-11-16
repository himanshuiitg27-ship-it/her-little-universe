import uuid
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationFailed
from app.models import JournalEntry
from app.schemas.common import Rewards
from app.schemas.core import JournalCreate, JournalUpdate, ReflectionSet
from app.services import dates, garden


def get_entry(db: Session, entry_id: uuid.UUID, kind: str | None = None) -> JournalEntry:
    entry = db.get(JournalEntry, entry_id)
    if entry is None or (kind and entry.kind != kind):
        raise NotFoundError("Entry not found")
    return entry


def list_entries(
    db: Session,
    kind: str | None = None,
    start: date | None = None,
    end: date | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[JournalEntry]:
    stmt = select(JournalEntry).order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
    if kind:
        stmt = stmt.where(JournalEntry.kind == kind)
    if start:
        stmt = stmt.where(JournalEntry.entry_date >= start)
    if end:
        stmt = stmt.where(JournalEntry.entry_date <= end)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                JournalEntry.title.ilike(like),
                JournalEntry.content.ilike(like),
                JournalEntry.happy_moment.ilike(like),
                JournalEntry.accomplishment.ilike(like),
                JournalEntry.improvement.ilike(like),
                JournalEntry.gratitude.ilike(like),
            )
        )
    return list(db.scalars(stmt.limit(limit).offset(offset)).all())


# ------------------------------------------------------------------ free journal


def create_journal(db: Session, data: JournalCreate) -> tuple[JournalEntry, Rewards]:
    day = data.entry_date or dates.today()
    entry = JournalEntry(kind="journal", entry_date=day, title=(data.title or "").strip() or None, content=data.content.strip())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    rewards = garden.record_events(db, [("journal_written", str(entry.id), day)])
    return entry, rewards


def update_journal(db: Session, entry_id: uuid.UUID, data: JournalUpdate) -> JournalEntry:
    entry = get_entry(db, entry_id, "journal")
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None and key in ("content", "entry_date"):
            continue
        setattr(entry, key, value.strip() if isinstance(value, str) else value)
    if "content" in data.model_fields_set:
        entry.ai_reflection = None
    db.commit()
    db.refresh(entry)
    return entry


def delete_entry(db: Session, entry_id: uuid.UUID) -> None:
    db.delete(get_entry(db, entry_id))
    db.commit()


# ------------------------------------------------------------------ night reflections


def get_reflection(db: Session, day: date) -> JournalEntry | None:
    return db.scalar(select(JournalEntry).where(JournalEntry.kind == "reflection", JournalEntry.entry_date == day))


def save_reflection(db: Session, day: date, data: ReflectionSet) -> tuple[JournalEntry, Rewards]:
    fields = data.model_dump()
    if not any(fields.values()):
        raise ValidationFailed("Answer at least one question to save your reflection")
    entry = get_reflection(db, day)
    if entry is None:
        entry = JournalEntry(kind="reflection", entry_date=day, **fields)
        db.add(entry)
    else:
        for key, value in fields.items():
            setattr(entry, key, value)
        entry.ai_reflection = None
    db.commit()
    db.refresh(entry)
    rewards = garden.record_events(db, [("reflection_saved", day.isoformat(), day)])
    return entry, rewards
