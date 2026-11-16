from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AppSettings
from app.schemas.core import SettingsUpdate

# Columns that cannot be NULL: an explicit null in a PATCH is ignored for these.
_NOT_NULL = {
    "display_name",
    "daily_study_goal_minutes",
    "sleep_goal_minutes",
    "target_bedtime",
    "target_wake_time",
    "theme",
    "pomodoro_focus_minutes",
    "pomodoro_break_minutes",
    "pomodoro_long_break_minutes",
    "ai_enabled",
}


def get_settings_row(db: Session) -> AppSettings:
    row = db.scalar(select(AppSettings).limit(1))
    if row is None:
        row = AppSettings()
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def update_settings(db: Session, data: SettingsUpdate) -> AppSettings:
    row = get_settings_row(db)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None and key in _NOT_NULL:
            continue
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row
