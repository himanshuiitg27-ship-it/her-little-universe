"""Happiness Garden: XP ledger, levels, unlockable items.

Design rules:
* XP is only ever *added*. Un-ticking a goal or missing a day never removes anything.
* Every award is idempotent via a unique (event_type, source_key) in `xp_events`.
"""

import math
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import GardenItem, GardenProgress, XpEvent
from app.schemas.common import Rewards, UnlockedItem
from app.schemas.rewards import GardenCatalogItem, GardenOut, XpEventOut
from app.services import achievements, dates

XP_TABLE = {
    "goal_completed": 10,
    "all_goals_bonus": 15,
    "habit_completed": 8,
    "topic_completed": 15,
    "mood_logged": 5,
    "reflection_saved": 10,
    "journal_written": 5,
    "sleep_logged": 5,
}

EVENT_LABELS = {
    "goal_completed": "Completed a goal",
    "all_goals_bonus": "Finished every goal today",
    "habit_completed": "Completed a habit",
    "topic_completed": "Finished a study topic",
    "study_session": "Focused study session",
    "mood_logged": "Checked in with your mood",
    "reflection_saved": "Night reflection",
    "journal_written": "Wrote in your journal",
    "sleep_logged": "Logged your sleep",
}


@dataclass(frozen=True)
class ItemDef:
    key: str
    name: str
    emoji: str
    kind: str  # flower | plant | creature | decoration
    unlock_xp: int


CATALOG: list[ItemDef] = [
    ItemDef("sprout", "Little Sprout", "🌱", "plant", 0),
    ItemDef("tulip", "Tulip", "🌷", "flower", 15),
    ItemDef("daisy", "Daisy", "🌼", "flower", 30),
    ItemDef("butterfly", "Butterfly", "🦋", "creature", 50),
    ItemDef("blossom", "Cherry Blossom", "🌸", "flower", 75),
    ItemDef("mushroom", "Cozy Mushroom", "🍄", "plant", 100),
    ItemDef("sunflower", "Sunflower", "🌻", "flower", 130),
    ItemDef("bee", "Busy Bee", "🐝", "creature", 170),
    ItemDef("herb", "Fresh Herbs", "🌿", "plant", 210),
    ItemDef("rose", "Rose", "🌹", "flower", 260),
    ItemDef("bench", "Garden Bench", "🪑", "decoration", 320),
    ItemDef("lantern", "Paper Lantern", "🏮", "decoration", 390),
    ItemDef("fountain", "Little Fountain", "⛲", "decoration", 470),
    ItemDef("hibiscus", "Hibiscus", "🌺", "flower", 560),
    ItemDef("rainbow", "Rainbow", "🌈", "decoration", 660),
    ItemDef("ladybug", "Ladybug", "🐞", "creature", 770),
    ItemDef("bouquet", "Bouquet", "💐", "flower", 890),
    ItemDef("tree", "Shady Tree", "🌳", "plant", 1020),
    ItemDef("bunny", "Garden Bunny", "🐇", "creature", 1160),
    ItemDef("strawberry", "Strawberry Patch", "🍓", "plant", 1320),
    ItemDef("palm", "Sunny Palm", "🌴", "plant", 1500),
    ItemDef("fairy", "Garden Fairy", "🧚", "creature", 1700),
    ItemDef("cottage", "Tiny Cottage", "🏡", "decoration", 1950),
    ItemDef("sparkles", "Stardust", "✨", "decoration", 2250),
    ItemDef("moon", "Moonlight", "🌙", "decoration", 2600),
]
CATALOG_BY_KEY = {i.key: i for i in CATALOG}


def level_for_xp(total_xp: int) -> int:
    return int(math.sqrt(max(total_xp, 0) / 25)) + 1


def xp_for_level(level: int) -> int:
    return 25 * (level - 1) ** 2


def get_progress(db: Session) -> GardenProgress:
    progress = db.scalar(select(GardenProgress).limit(1))
    if progress is None:
        progress = GardenProgress(total_xp=0, level=1)
        db.add(progress)
        db.flush()
    return progress


def _unlock_items(db: Session, progress: GardenProgress) -> list[UnlockedItem]:
    owned = set(db.scalars(select(GardenItem.item_key)).all())
    slot = len(owned)
    fresh: list[UnlockedItem] = []
    for item in CATALOG:
        if item.key in owned or item.unlock_xp > progress.total_xp:
            continue
        db.add(GardenItem(item_key=item.key, slot=slot, unlocked_at=dates.now()))
        slot += 1
        fresh.append(UnlockedItem(key=item.key, name=item.name, emoji=item.emoji, kind=item.kind))
    if fresh:
        db.flush()
    return fresh


def record_events(
    db: Session,
    events: list[tuple[str, str, date] | tuple[str, str, date, int]],
) -> Rewards:
    """Award XP for one or more events, unlock garden items/badges, commit, summarise.

    Each event is (event_type, source_key, event_date[, xp]). Repeats are ignored silently.
    """
    progress = get_progress(db)
    old_level = progress.level
    gained = 0
    for event in events:
        event_type, source_key, event_date = event[0], event[1], event[2]
        xp = event[3] if len(event) > 3 else XP_TABLE.get(event_type, 0)
        if xp <= 0:
            continue
        exists = db.scalar(
            select(XpEvent.id).where(XpEvent.event_type == event_type, XpEvent.source_key == source_key)
        )
        if exists:
            continue
        db.add(XpEvent(event_type=event_type, source_key=source_key, xp=xp, event_date=event_date))
        progress.total_xp += xp
        gained += xp

    progress.level = max(progress.level, level_for_xp(progress.total_xp))
    db.flush()
    new_items = _unlock_items(db, progress)
    new_badges = achievements.evaluate(db)
    # Garden-level badges depend on the freshly updated level; re-check once.
    if progress.level != old_level:
        new_badges += achievements.evaluate(db)
    db.commit()
    return Rewards(
        xp_gained=gained,
        total_xp=progress.total_xp,
        level=progress.level,
        leveled_up=progress.level > old_level,
        new_items=new_items,
        new_achievements=new_badges,
    )


def _catalog_item(item: ItemDef, owned: dict[str, GardenItem]) -> GardenCatalogItem:
    record = owned.get(item.key)
    return GardenCatalogItem(
        key=item.key,
        name=item.name,
        emoji=item.emoji,
        kind=item.kind,
        unlock_xp=item.unlock_xp,
        unlocked=record is not None,
        slot=record.slot if record else None,
        unlocked_at=record.unlocked_at if record else None,
    )


def get_garden(db: Session) -> GardenOut:
    progress = get_progress(db)
    if _unlock_items(db, progress):
        db.commit()
    owned = {i.item_key: i for i in db.scalars(select(GardenItem)).all()}
    items = [_catalog_item(i, owned) for i in CATALOG]
    next_unlock = next((i for i in items if not i.unlocked), None)

    base = xp_for_level(progress.level)
    span = xp_for_level(progress.level + 1) - base
    into = progress.total_xp - base

    events = db.scalars(select(XpEvent).order_by(XpEvent.created_at.desc()).limit(12)).all()
    recent = [
        XpEventOut(
            event_type=e.event_type,
            xp=e.xp,
            event_date=e.event_date,
            created_at=e.created_at,
            label=EVENT_LABELS.get(e.event_type, e.event_type.replace("_", " ").capitalize()),
        )
        for e in events
    ]
    xp_today = int(
        db.scalar(select(func.coalesce(func.sum(XpEvent.xp), 0)).where(XpEvent.event_date == dates.today())) or 0
    )
    return GardenOut(
        total_xp=progress.total_xp,
        level=progress.level,
        xp_into_level=into,
        xp_for_next_level=span,
        progress_pct=min(100, int(into * 100 / span)) if span else 100,
        unlocked_count=sum(1 for i in items if i.unlocked),
        total_count=len(items),
        next_unlock=next_unlock,
        items=items,
        recent_events=recent,
        xp_today=xp_today,
    )
