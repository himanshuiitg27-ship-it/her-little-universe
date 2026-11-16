import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationFailed
from app.models import MoodEntry
from app.schemas.common import Rewards
from app.schemas.core import MoodOption, MoodOut, MoodSet, MoodTrend
from app.services import dates, garden

MOODS: list[MoodOption] = [
    MoodOption(key="joyful", emoji="😄", label="Joyful", score=5),
    MoodOption(key="loved", emoji="🥰", label="Loved", score=5),
    MoodOption(key="content", emoji="🙂", label="Content", score=4),
    MoodOption(key="calm", emoji="😌", label="Calm", score=4),
    MoodOption(key="neutral", emoji="😐", label="Okay", score=3),
    MoodOption(key="tired", emoji="😴", label="Tired", score=2),
    MoodOption(key="anxious", emoji="😟", label="Anxious", score=2),
    MoodOption(key="frustrated", emoji="😤", label="Frustrated", score=2),
    MoodOption(key="sad", emoji="😢", label="Sad", score=1),
    MoodOption(key="overwhelmed", emoji="😵‍💫", label="Overwhelmed", score=1),
]
MOODS_BY_KEY = {m.key: m for m in MOODS}


def to_out(entry: MoodEntry) -> MoodOut:
    out = MoodOut.model_validate(entry)
    meta = MOODS_BY_KEY.get(entry.mood)
    if meta:
        out.emoji, out.label = meta.emoji, meta.label
    return out


def get_entry(db: Session, entry_id: uuid.UUID) -> MoodEntry:
    entry = db.get(MoodEntry, entry_id)
    if entry is None:
        raise NotFoundError("Mood entry not found")
    return entry


def get_by_date(db: Session, day: date) -> MoodEntry | None:
    return db.scalar(select(MoodEntry).where(MoodEntry.entry_date == day))


def set_mood(db: Session, data: MoodSet) -> tuple[MoodEntry, Rewards]:
    meta = MOODS_BY_KEY.get(data.mood)
    if meta is None:
        raise ValidationFailed(f"Unknown mood '{data.mood}'")
    day = data.entry_date or dates.today()
    note = (data.note or "").strip() or None
    entry = get_by_date(db, day)
    if entry is None:
        entry = MoodEntry(entry_date=day, mood=meta.key, score=meta.score, note=note)
        db.add(entry)
    else:
        if entry.mood != meta.key or entry.note != note:
            entry.ai_reflection = None  # stale once the mood or note changes
        entry.mood, entry.score, entry.note = meta.key, meta.score, note
    db.commit()
    db.refresh(entry)
    rewards = garden.record_events(db, [("mood_logged", day.isoformat(), day)])
    return entry, rewards


def delete_entry(db: Session, entry_id: uuid.UUID) -> None:
    db.delete(get_entry(db, entry_id))
    db.commit()


def list_entries(db: Session, start: date, end: date) -> list[MoodEntry]:
    return list(
        db.scalars(
            select(MoodEntry).where(MoodEntry.entry_date.between(start, end)).order_by(MoodEntry.entry_date.desc())
        ).all()
    )


def trends(db: Session, days: int) -> MoodTrend:
    end = dates.today()
    start = end - timedelta(days=days - 1)
    entries = sorted(list_entries(db, start, end), key=lambda e: e.entry_date)
    counts: dict[str, int] = {}
    for e in entries:
        counts[e.mood] = counts.get(e.mood, 0) + 1
    most_common = max(counts, key=counts.get) if counts else None
    return MoodTrend(
        days=days,
        average_score=round(sum(e.score for e in entries) / len(entries), 2) if entries else None,
        entries_count=len(entries),
        most_common=most_common,
        series=[
            {
                "date": e.entry_date.isoformat(),
                "score": e.score,
                "mood": e.mood,
                "emoji": MOODS_BY_KEY[e.mood].emoji if e.mood in MOODS_BY_KEY else "🙂",
            }
            for e in entries
        ],
        distribution=[
            {"mood": m.key, "emoji": m.emoji, "label": m.label, "count": counts[m.key]}
            for m in MOODS
            if m.key in counts
        ],
    )
