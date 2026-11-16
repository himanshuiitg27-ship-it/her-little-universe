"""Date/time helpers. "Today" is always evaluated in APP_TIMEZONE, never the server's zone."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import get_settings


def app_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().app_timezone)


def now() -> datetime:
    return datetime.now(app_tz())


def today() -> date:
    return now().date()


def ensure_aware(dt: datetime) -> datetime:
    """Naive datetimes (e.g. read back from SQLite) are interpreted as app-local wall time."""
    return dt.replace(tzinfo=app_tz()) if dt.tzinfo is None else dt


def to_local(dt: datetime) -> datetime:
    return ensure_aware(dt).astimezone(app_tz())


def week_bounds(anchor: date) -> tuple[date, date]:
    """Monday..Sunday containing anchor."""
    start = anchor - timedelta(days=anchor.weekday())
    return start, start + timedelta(days=6)


def month_bounds(anchor: date) -> tuple[date, date]:
    start = anchor.replace(day=1)
    nxt = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, nxt - timedelta(days=1)


def date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def part_of_day(hour: int) -> str:
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 22:
        return "evening"
    return "night"
