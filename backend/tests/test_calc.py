from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.calc import compute_streaks, sleep_consistency, sleep_duration_minutes

IST = ZoneInfo("Asia/Kolkata")
TODAY = date(2026, 11, 15)


def days(*offsets):
    return {TODAY - timedelta(days=o) for o in offsets}


def test_streak_today_done():
    assert compute_streaks(days(0, 1, 2), TODAY) == (3, 3)


def test_streak_alive_if_yesterday_done_but_today_pending():
    # Not having done it *yet* today must never reset the streak.
    assert compute_streaks(days(1, 2, 3), TODAY) == (3, 3)


def test_streak_breaks_after_a_missed_day_but_keeps_longest():
    assert compute_streaks(days(2, 3, 4, 5), TODAY) == (0, 4)


def test_streak_empty():
    assert compute_streaks(set(), TODAY) == (0, 0)


def test_longest_streak_is_separate_from_current():
    assert compute_streaks(days(0, 1, 5, 6, 7, 8), TODAY) == (2, 4)


def test_overnight_sleep_duration():
    bed = datetime(2026, 11, 14, 23, 0, tzinfo=IST)
    wake = datetime(2026, 11, 15, 7, 30, tzinfo=IST)
    assert sleep_duration_minutes(bed, wake) == 510


def _night(day, bed_h, bed_m, wake_h, wake_m):
    bed = datetime(2026, 11, day, bed_h, bed_m, tzinfo=IST)
    wake = datetime(2026, 11, day + 1, wake_h, wake_m, tzinfo=IST)
    return bed, wake


def test_consistency_needs_three_records():
    assert sleep_consistency([_night(1, 23, 0, 7, 0)] * 2)["score"] is None


def test_consistency_perfect():
    result = sleep_consistency([_night(d, 23, 0, 7, 0) for d in (1, 2, 3, 4)])
    assert result["score"] == 100
    assert result["avg_bedtime"] == "23:00"
    assert result["avg_wake"] == "07:00"


def test_consistency_handles_bedtimes_across_midnight():
    # 23:30 / 00:30 are an hour apart, not 23 hours apart.
    nights = [_night(1, 23, 30, 7, 0), _night(2, 0, 30, 7, 0), _night(3, 23, 30, 7, 0), _night(4, 0, 30, 7, 0)]
    result = sleep_consistency(nights)
    assert result["score"] is not None and result["score"] > 70


def test_consistency_irregular_scores_lower():
    steady = sleep_consistency([_night(d, 23, 0, 7, 0) for d in (1, 2, 3, 4)])["score"]
    messy = sleep_consistency(
        [_night(1, 21, 0, 5, 0), _night(2, 2, 0, 10, 30), _night(3, 23, 0, 7, 0), _night(4, 1, 0, 9, 0)]
    )["score"]
    assert messy < steady
