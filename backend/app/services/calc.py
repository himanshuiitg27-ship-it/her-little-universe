"""Pure calculation helpers (no database access) so they are easy to unit test."""

import statistics
from datetime import date, datetime, timedelta

from app.services.dates import to_local


def compute_streaks(done_dates: set[date], today: date) -> tuple[int, int]:
    """Return (current_streak, longest_streak).

    A streak that was alive yesterday is still "current" today, so a day that has not
    been completed *yet* never resets the counter. Only a fully missed day ends a streak.
    """
    if not done_dates:
        return 0, 0
    cursor = today if today in done_dates else today - timedelta(days=1)
    current = 0
    while cursor in done_dates:
        current += 1
        cursor -= timedelta(days=1)

    longest = run = 0
    previous: date | None = None
    for d in sorted(done_dates):
        run = run + 1 if previous is not None and (d - previous).days == 1 else 1
        longest = max(longest, run)
        previous = d
    return current, longest


def sleep_duration_minutes(bedtime: datetime, wake_time: datetime) -> int:
    return int((wake_time - bedtime).total_seconds() // 60)


def _fmt_minutes(total: float, offset: int = 0) -> str:
    m = int(round(total + offset)) % 1440
    return f"{m // 60:02d}:{m % 60:02d}"


def sleep_consistency(records: list[tuple[datetime, datetime]]) -> dict:
    """How steady bedtimes and wake-ups are.

    Bedtimes are measured as minutes since 12:00 so that 23:30 and 00:30 are one hour apart.
    The score is 100 when the standard deviation is 0 and reaches 0 at 120 minutes.
    Needs at least 3 records, otherwise score is None.
    """
    if len(records) < 3:
        return {"score": None, "label": None, "avg_bedtime": None, "avg_wake": None}

    bed, wake = [], []
    for b, w in records:
        lb, lw = to_local(b), to_local(w)
        bed.append((lb.hour * 60 + lb.minute - 720) % 1440)
        wake.append(lw.hour * 60 + lw.minute)

    spread = (statistics.pstdev(bed) + statistics.pstdev(wake)) / 2
    score = int(round(max(0.0, 100 - spread * 100 / 120)))
    if score >= 85:
        label = "Beautifully steady"
    elif score >= 70:
        label = "Nicely steady"
    elif score >= 50:
        label = "Finding your rhythm"
    else:
        label = "Still settling in"
    return {
        "score": score,
        "label": label,
        "avg_bedtime": _fmt_minutes(statistics.mean(bed), 720),
        "avg_wake": _fmt_minutes(statistics.mean(wake)),
    }
