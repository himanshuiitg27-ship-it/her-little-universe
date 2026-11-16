import random
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationFailed
from app.models import Surprise
from app.schemas.rewards import SurpriseCreate, SurpriseUpdate
from app.services import dates

DAILY_KINDS = ("motivation", "compliment", "special")


def get_surprise(db: Session, surprise_id: uuid.UUID) -> Surprise:
    s = db.get(Surprise, surprise_id)
    if s is None:
        raise NotFoundError("Surprise not found")
    return s


def list_surprises(db: Session, kind: str | None = None, custom_only: bool = False) -> list[Surprise]:
    stmt = select(Surprise).order_by(Surprise.is_custom.desc(), Surprise.created_at.desc())
    if kind:
        stmt = stmt.where(Surprise.kind == kind)
    if custom_only:
        stmt = stmt.where(Surprise.is_custom.is_(True))
    return list(db.scalars(stmt).all())


def create_surprise(db: Session, data: SurpriseCreate) -> Surprise:
    s = Surprise(kind=data.kind, content=data.content, emoji=data.emoji, is_custom=True)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def update_surprise(db: Session, surprise_id: uuid.UUID, data: SurpriseUpdate) -> Surprise:
    s = get_surprise(db, surprise_id)
    changes = data.model_dump(exclude_unset=True)
    if not s.is_custom and any(k in changes for k in ("content", "kind")):
        raise ValidationFailed("Built-in messages can be switched on or off, but not rewritten. Add your own instead!")
    for key, value in changes.items():
        if value is None and key in ("content", "kind", "is_active"):
            continue
        setattr(s, key, value)
    db.commit()
    db.refresh(s)
    return s


def delete_surprise(db: Session, surprise_id: uuid.UUID) -> None:
    s = get_surprise(db, surprise_id)
    if not s.is_custom:
        raise ValidationFailed("Built-in messages can't be deleted. Turn them off instead.")
    db.delete(s)
    db.commit()


def _mark_shown(db: Session, s: Surprise) -> Surprise:
    s.times_shown += 1
    s.last_shown_at = dates.now()
    db.commit()
    db.refresh(s)
    return s


def _active(db: Session, kinds: tuple[str, ...]) -> list[Surprise]:
    return list(
        db.scalars(
            select(Surprise)
            .where(Surprise.is_active.is_(True), Surprise.kind.in_(kinds))
            .order_by(Surprise.created_at, Surprise.id)
        ).all()
    )


def daily_surprise(db: Session, kinds: tuple[str, ...] = DAILY_KINDS, mark_shown: bool = True) -> Surprise | None:
    """Same surprise all day, a new one tomorrow (deterministic on the date, no extra table)."""
    pool = _active(db, kinds)
    if not pool:
        return None
    chosen = pool[dates.today().toordinal() % len(pool)]
    return _mark_shown(db, chosen) if mark_shown else chosen


def random_surprise(db: Session, kind: str | None = None) -> Surprise | None:
    pool = _active(db, (kind,) if kind else ("motivation", "compliment", "hug", "special"))
    if not pool:
        return None
    if len(pool) > 1:
        last = max(pool, key=lambda s: s.last_shown_at.timestamp() if s.last_shown_at else 0)
        if last.last_shown_at:
            pool = [s for s in pool if s.id != last.id]
    return _mark_shown(db, random.choice(pool))
