"""Achievement catalog, metric computation and unlock evaluation.

Badge *definitions* are static configuration. Whether a badge is unlocked, and how close she is
to each one, is always computed from the database.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import (
    Achievement,
    DailyGoal,
    GardenProgress,
    Habit,
    HabitLog,
    JournalEntry,
    MoodEntry,
    SleepRecord,
    StudySession,
    StudyTopic,
)
from app.schemas.common import UnlockedBadge
from app.schemas.rewards import AchievementList, AchievementOut, MonthlySummary
from app.services import calc, dates


@dataclass(frozen=True)
class BadgeDef:
    key: str
    title: str
    description: str
    category: str  # study | daily | habit | wellness | garden
    icon: str
    metric: str
    threshold: int


CATALOG: list[BadgeDef] = [
    # Study milestones
    BadgeDef("first_focus", "First Focus", "Study for 25 minutes in total", "study", "🌱", "study_minutes_total", 25),
    BadgeDef("scholar_5h", "Budding Scholar", "Study for 5 hours in total", "study", "📚", "study_minutes_total", 300),
    BadgeDef("scholar_25h", "Dedicated Scholar", "Study for 25 hours in total", "study", "🎓", "study_minutes_total", 1500),
    BadgeDef("scholar_100h", "Knowledge Keeper", "Study for 100 hours in total", "study", "🏛️", "study_minutes_total", 6000),
    BadgeDef("study_streak_3", "Three Day Glow", "Study 3 days in a row", "study", "✨", "study_streak_best", 3),
    BadgeDef("study_streak_7", "Weekly Wonder", "Study 7 days in a row", "study", "🌟", "study_streak_best", 7),
    BadgeDef("topics_1", "Topic Tamer", "Complete your first study topic", "study", "🧩", "topics_completed", 1),
    BadgeDef("topics_10", "Topic Collector", "Complete 10 study topics", "study", "🗂️", "topics_completed", 10),
    BadgeDef("topics_50", "Topic Master", "Complete 50 study topics", "study", "👑", "topics_completed", 50),
    # Daily & weekly
    BadgeDef("goals_today_3", "Triple Sparkle", "Complete 3 goals in a single day", "daily", "💫", "goals_today", 3),
    BadgeDef("perfect_day_1", "Perfect Day", "Complete every goal on a day (2+ goals)", "daily", "🌈", "perfect_days", 1),
    BadgeDef("perfect_day_7", "Seven Perfect Days", "Have 7 perfect goal days", "daily", "🦋", "perfect_days", 7),
    BadgeDef("goals_1", "First Step", "Complete your first daily goal", "daily", "👣", "goals_completed", 1),
    BadgeDef("goals_25", "Goal Getter", "Complete 25 daily goals", "daily", "🎯", "goals_completed", 25),
    BadgeDef("goals_100", "Goal Galaxy", "Complete 100 daily goals", "daily", "🪐", "goals_completed", 100),
    BadgeDef("week_study_10h", "Productive Week", "Study 10 hours this week", "daily", "📅", "week_study_minutes", 600),
    BadgeDef("week_study_20h", "Power Week", "Study 20 hours this week", "daily", "🚀", "week_study_minutes", 1200),
    # Habits
    BadgeDef("habit_streak_3", "Habit Seedling", "Keep any habit going for 3 days", "habit", "🌿", "habit_best_streak", 3),
    BadgeDef("habit_streak_7", "Habit Bloom", "Keep any habit going for 7 days", "habit", "🌷", "habit_best_streak", 7),
    BadgeDef("habit_streak_14", "Habit Garden", "Keep any habit going for 14 days", "habit", "🌻", "habit_best_streak", 14),
    BadgeDef("habit_streak_30", "Habit Hero", "Keep any habit going for 30 days", "habit", "🏆", "habit_best_streak", 30),
    BadgeDef("habit_days_30", "Steady Bloomer", "Complete habits on 30 occasions", "habit", "🌺", "habit_days_done", 30),
    BadgeDef("habit_days_100", "Habit Forest", "Complete habits on 100 occasions", "habit", "🌳", "habit_days_done", 100),
    # Wellness
    BadgeDef("sleep_logs_7", "Sleep Watcher", "Log 7 nights of sleep", "wellness", "🌙", "sleep_logs", 7),
    BadgeDef("sleep_logs_30", "Dream Keeper", "Log 30 nights of sleep", "wellness", "💤", "sleep_logs", 30),
    BadgeDef("sleep_steady", "Steady Sleeper", "Reach 80% sleep consistency (7+ nights)", "wellness", "😴", "sleep_consistency", 80),
    BadgeDef("mood_logs_7", "Mood Explorer", "Check in with your mood 7 times", "wellness", "🎭", "mood_logs", 7),
    BadgeDef("mood_logs_30", "Heart Listener", "Check in with your mood 30 times", "wellness", "💗", "mood_logs", 30),
    BadgeDef("journal_1", "Dear Diary", "Write your first journal entry", "wellness", "📓", "journal_entries", 1),
    BadgeDef("journal_10", "Storyteller", "Write 10 journal entries", "wellness", "✍️", "journal_entries", 10),
    BadgeDef("reflect_1", "Night Thinker", "Complete your first night reflection", "wellness", "🌃", "reflections", 1),
    BadgeDef("reflect_7", "Evening Ritual", "Complete 7 night reflections", "wellness", "🕯️", "reflections", 7),
    BadgeDef("reflect_30", "Gratitude Glow", "Complete 30 night reflections", "wellness", "🙏", "reflections", 30),
    # Garden
    BadgeDef("garden_3", "Little Gardener", "Grow your garden to level 3", "garden", "🧑‍🌾", "garden_level", 3),
    BadgeDef("garden_5", "Green Thumb", "Grow your garden to level 5", "garden", "🌼", "garden_level", 5),
    BadgeDef("garden_10", "Garden Queen", "Grow your garden to level 10", "garden", "👸", "garden_level", 10),
]
CATALOG_BY_KEY = {b.key: b for b in CATALOG}


# --------------------------------------------------------------------------- metrics


def _scalar(db: Session, stmt) -> int:
    return int(db.scalar(stmt) or 0)


def compute_metrics(db: Session, today: date | None = None) -> dict[str, int]:
    today = today or dates.today()
    week_start, week_end = dates.week_bounds(today)

    study_days = set(db.scalars(select(StudySession.session_date).distinct()).all())
    _, study_best = calc.compute_streaks(study_days, today)

    # Perfect goal days: every goal done and at least two goals that day.
    rows = db.execute(
        select(
            DailyGoal.goal_date,
            func.count(DailyGoal.id),
            func.sum(case((DailyGoal.is_completed.is_(True), 1), else_=0)),
        ).group_by(DailyGoal.goal_date)
    ).all()
    perfect = sum(1 for _, total, done in rows if total >= 2 and int(done or 0) == total)

    # Habit streaks / completion occasions.
    habit_rows = db.execute(
        select(HabitLog.habit_id, HabitLog.log_date)
        .join(Habit, Habit.id == HabitLog.habit_id)
        .where(HabitLog.count >= Habit.target_count)
    ).all()
    by_habit: dict = {}
    for hid, d in habit_rows:
        by_habit.setdefault(hid, set()).add(d)
    best_habit = max((calc.compute_streaks(s, today)[1] for s in by_habit.values()), default=0)

    sleep_rows = db.execute(
        select(SleepRecord.bedtime, SleepRecord.wake_time).order_by(SleepRecord.sleep_date.desc()).limit(14)
    ).all()
    consistency = calc.sleep_consistency([(b, w) for b, w in sleep_rows]) if len(sleep_rows) >= 7 else {}

    progress = db.scalar(select(GardenProgress))

    return {
        "study_minutes_total": _scalar(db, select(func.coalesce(func.sum(StudySession.duration_minutes), 0))),
        "study_streak_best": study_best,
        "topics_completed": _scalar(db, select(func.count(StudyTopic.id)).where(StudyTopic.is_completed.is_(True))),
        "goals_completed": _scalar(db, select(func.count(DailyGoal.id)).where(DailyGoal.is_completed.is_(True))),
        "goals_today": _scalar(
            db,
            select(func.count(DailyGoal.id)).where(
                DailyGoal.goal_date == today, DailyGoal.is_completed.is_(True)
            ),
        ),
        "perfect_days": perfect,
        "week_study_minutes": _scalar(
            db,
            select(func.coalesce(func.sum(StudySession.duration_minutes), 0)).where(
                StudySession.session_date.between(week_start, week_end)
            ),
        ),
        "habit_best_streak": best_habit,
        "habit_days_done": len(habit_rows),
        "sleep_logs": _scalar(db, select(func.count(SleepRecord.id))),
        "sleep_consistency": consistency.get("score") or 0,
        "mood_logs": _scalar(db, select(func.count(MoodEntry.id))),
        "journal_entries": _scalar(db, select(func.count(JournalEntry.id)).where(JournalEntry.kind == "journal")),
        "reflections": _scalar(db, select(func.count(JournalEntry.id)).where(JournalEntry.kind == "reflection")),
        "garden_level": progress.level if progress else 1,
    }


# --------------------------------------------------------------------------- evaluation


def evaluate(db: Session, today: date | None = None) -> list[UnlockedBadge]:
    """Unlock any badge whose threshold is reached. Returns the badges unlocked right now."""
    today = today or dates.today()
    metrics = compute_metrics(db, today)
    already = set(db.scalars(select(Achievement.key)).all())
    newly: list[UnlockedBadge] = []
    for badge in CATALOG:
        if badge.key in already or metrics.get(badge.metric, 0) < badge.threshold:
            continue
        db.add(Achievement(key=badge.key, unlocked_at=dates.now(), unlocked_on=today))
        newly.append(UnlockedBadge(key=badge.key, title=badge.title, icon=badge.icon, description=badge.description))
    if newly:
        db.flush()
    return newly


def _to_out(badge: BadgeDef, metrics: dict, unlocked: dict[str, Achievement]) -> AchievementOut:
    value = int(metrics.get(badge.metric, 0))
    record = unlocked.get(badge.key)
    pct = 100 if record else min(99, int(value * 100 / badge.threshold))
    return AchievementOut(
        key=badge.key,
        title=badge.title,
        description=badge.description,
        category=badge.category,
        icon=badge.icon,
        threshold=badge.threshold,
        value=min(value, badge.threshold) if record else value,
        progress_pct=pct,
        unlocked=record is not None,
        unlocked_at=record.unlocked_at if record else None,
    )


def list_achievements(db: Session) -> AchievementList:
    today = dates.today()
    evaluate(db, today)
    db.commit()
    metrics = compute_metrics(db, today)
    unlocked = {a.key: a for a in db.scalars(select(Achievement)).all()}
    outs = [_to_out(b, metrics, unlocked) for b in CATALOG]
    week_start, _ = dates.week_bounds(today)
    today_list = [o for o in outs if o.unlocked and unlocked[o.key].unlocked_on == today]
    week_list = [o for o in outs if o.unlocked and unlocked[o.key].unlocked_on >= week_start]
    return AchievementList(
        unlocked_count=sum(1 for o in outs if o.unlocked),
        total_count=len(outs),
        today=today_list,
        this_week=week_list,
        achievements=outs,
    )


def monthly_summary(db: Session, anchor: date) -> MonthlySummary:
    from app.models import XpEvent

    start, end = dates.month_bounds(anchor)
    metrics = compute_metrics(db)
    unlocked = {a.key: a for a in db.scalars(select(Achievement)).all()}

    goal_rows = db.execute(
        select(func.count(DailyGoal.id), func.sum(case((DailyGoal.is_completed.is_(True), 1), else_=0))).where(
            DailyGoal.goal_date.between(start, end)
        )
    ).one()

    habits = db.scalars(select(Habit).where(Habit.is_active.is_(True))).all()
    done_logs = _scalar(
        db,
        select(func.count(HabitLog.id))
        .join(Habit, Habit.id == HabitLog.habit_id)
        .where(HabitLog.log_date.between(start, end), HabitLog.count >= Habit.target_count),
    )
    last_day = min(end, dates.today())
    elapsed = max(0, (last_day - start).days + 1)
    possible = len(habits) * elapsed
    habit_pct = min(100, int(done_logs * 100 / possible)) if possible else 0

    avg_sleep = db.scalar(select(func.avg(SleepRecord.duration_minutes)).where(SleepRecord.sleep_date.between(start, end)))
    avg_mood = db.scalar(select(func.avg(MoodEntry.score)).where(MoodEntry.entry_date.between(start, end)))
    study_days = _scalar(
        db,
        select(func.count(func.distinct(StudySession.session_date))).where(
            StudySession.session_date.between(start, end)
        ),
    )
    badges = [
        _to_out(CATALOG_BY_KEY[a.key], metrics, unlocked)
        for a in unlocked.values()
        if start <= a.unlocked_on <= end and a.key in CATALOG_BY_KEY
    ]
    topics_done = _scalar(
        db,
        select(func.count(StudyTopic.id)).where(
            StudyTopic.is_completed.is_(True),
            StudyTopic.completed_at >= datetime.combine(start, datetime.min.time(), tzinfo=dates.app_tz()),
            StudyTopic.completed_at < datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=dates.app_tz()),
        ),
    )
    return MonthlySummary(
        month=start.strftime("%Y-%m"),
        start=start,
        end=end,
        study_minutes=_scalar(
            db,
            select(func.coalesce(func.sum(StudySession.duration_minutes), 0)).where(
                StudySession.session_date.between(start, end)
            ),
        ),
        study_days=study_days,
        topics_completed=topics_done,
        goals_completed=int(goal_rows[1] or 0),
        goals_total=int(goal_rows[0] or 0),
        habit_completion_pct=habit_pct,
        average_sleep_minutes=int(avg_sleep) if avg_sleep is not None else None,
        average_mood_score=round(float(avg_mood), 1) if avg_mood is not None else None,
        journal_entries=_scalar(
            db,
            select(func.count(JournalEntry.id)).where(
                JournalEntry.kind == "journal", JournalEntry.entry_date.between(start, end)
            ),
        ),
        reflections=_scalar(
            db,
            select(func.count(JournalEntry.id)).where(
                JournalEntry.kind == "reflection", JournalEntry.entry_date.between(start, end)
            ),
        ),
        xp_earned=_scalar(db, select(func.coalesce(func.sum(XpEvent.xp), 0)).where(XpEvent.event_date.between(start, end))),
        badges_earned=badges,
    )
