"""First-run starter content. Runs once (tracked by app_settings.seeded) so anything she later
edits or deletes is never silently re-created."""

import logging
from datetime import time

from sqlalchemy.orm import Session

from app.models import Habit, Reminder, Surprise
from app.services.settings import get_settings_row

logger = logging.getLogger(__name__)

STARTER_HABITS = [
    # name, emoji, category, target, unit
    ("Exercise", "🏃‍♀️", "exercise", 1, "session"),
    ("Reading", "📖", "reading", 1, "session"),
    ("Hydration", "💧", "hydration", 8, "glasses"),
    ("Revision", "📝", "revision", 1, "session"),
]

STARTER_SURPRISES: dict[str, list[tuple[str, str]]] = {
    "motivation": [
        ("Small steps still move you forward. Today, one gentle step is enough.", "🌱"),
        ("You don't have to be perfect to be proud of yourself.", "🌸"),
        ("Rest is part of the plan, not a break from it.", "🌙"),
        ("Every page you read today is a gift to your future self.", "📚"),
        ("You've handled every hard day so far. You're doing it again.", "💪"),
        ("Progress isn't loud. It's quiet, steady and already happening.", "✨"),
        ("Be as kind to yourself as you are to the people you love.", "💗"),
        ("Bloom at your own pace. No flower competes with the one next to it.", "🌷"),
        ("A tiny bit of effort today beats a perfect plan tomorrow.", "🦋"),
        ("Your best today might look different from yesterday, and that's okay.", "🌤️"),
        ("Breathe in. You are exactly where you need to be right now.", "🍃"),
        ("Done is lovely. Even a little bit counts.", "🍓"),
    ],
    "compliment": [
        ("You have a way of making hard things look graceful.", "🌹"),
        ("Your curiosity is one of the most beautiful things about you.", "✨"),
        ("You work so hard, and it shows in the smallest details.", "🌟"),
        ("Your kindness is quietly changing the people around you.", "💗"),
        ("You light up a room without even trying.", "🌻"),
        ("Your determination is honestly inspiring.", "🔥"),
        ("You're smarter than you give yourself credit for.", "🧠"),
        ("Your smile is a small sunrise.", "🌅"),
        ("You're someone's favourite person, and probably more than one person's.", "🥰"),
        ("The way you keep going, even when it's tough, is remarkable.", "🌈"),
    ],
    "hug": [
        ("Sending you the warmest, longest hug. Take a deep breath, I've got you.", "🤗"),
        ("A big squishy hug, just because you deserve one.", "🫂"),
        ("Come here. One cozy hug, no questions asked.", "🧸"),
        ("Consider yourself hugged, wrapped in a soft blanket of care.", "💞"),
        ("Hug incoming! Hold on tight, everything will be okay.", "🐻"),
        ("A gentle hug for a long day. You did enough.", "☁️"),
    ],
}


def seed_defaults(db: Session) -> bool:
    """Insert starter habits, surprises and a bedtime reminder once. Returns True if it seeded."""
    row = get_settings_row(db)
    if row.seeded:
        return False

    for order, (name, emoji, category, target, unit) in enumerate(STARTER_HABITS):
        db.add(Habit(name=name, emoji=emoji, category=category, target_count=target, unit=unit, sort_order=order))

    for kind, items in STARTER_SURPRISES.items():
        for content, emoji in items:
            db.add(Surprise(kind=kind, content=content, emoji=emoji, is_custom=False))

    db.add(
        Reminder(
            title="Wind down for bed",
            message="Time to put the screens away and get cozy. 🌙",
            kind="sleep",
            remind_time=time(22, 30),
            days_of_week=[0, 1, 2, 3, 4, 5, 6],
            is_enabled=True,
        )
    )
    row.seeded = True
    db.commit()
    logger.info("Seeded starter habits, surprises and bedtime reminder")
    return True
