from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import DailyGoal, SleepRecord, StudySession, StudyTopic
from app.schemas.dashboard import (
    DashGarden,
    DashGoal,
    DashGoals,
    DashHabits,
    DashMessage,
    DashSleep,
    DashStudy,
    DashTasks,
    Dashboard,
    DashWeekDay,
)
from app.services import calendar, dates, garden, habits, journal, mood, study, surprises
from app.services.settings import get_settings_row


def build_dashboard(db: Session) -> Dashboard:
    now = dates.now()
    today = now.date()
    cfg = get_settings_row(db)

    # ---- study
    today_minutes = int(
        db.scalar(
            select(func.coalesce(func.sum(StudySession.duration_minutes), 0)).where(StudySession.session_date == today)
        )
        or 0
    )
    sessions_today = int(db.scalar(select(func.count(StudySession.id)).where(StudySession.session_date == today)) or 0)
    study_block = DashStudy(
        today_minutes=today_minutes,
        goal_minutes=cfg.daily_study_goal_minutes,
        goal_pct=min(100, int(today_minutes * 100 / cfg.daily_study_goal_minutes)),
        sessions_today=sessions_today,
    )

    # ---- sleep (most recent night)
    last = db.scalar(select(SleepRecord).order_by(SleepRecord.sleep_date.desc()).limit(1))
    sleep_block = DashSleep(
        last_duration_minutes=last.duration_minutes if last else None,
        last_sleep_date=last.sleep_date if last else None,
        last_bedtime=last.bedtime if last else None,
        last_wake_time=last.wake_time if last else None,
        goal_minutes=cfg.sleep_goal_minutes,
        goal_pct=min(100, int(last.duration_minutes * 100 / cfg.sleep_goal_minutes)) if last else None,
    )

    # ---- tasks: topics that are planned for today (or earlier), due soon, or overdue
    pending_topics = list(
        db.scalars(
            select(StudyTopic).where(
                StudyTopic.is_completed.is_(False),
                or_(StudyTopic.planned_date <= today, StudyTopic.deadline <= today),
            )
        ).all()
    )
    ranked = {p.topic.id: p.score for p in study.prioritized_topics(db)}
    pending_topics.sort(key=lambda t: -ranked.get(t.id, 0))
    actual = study._actual_minutes(db, [t.id for t in pending_topics])
    lo = now.replace(hour=0, minute=0, second=0, microsecond=0)
    completed_today = int(
        db.scalar(
            select(func.count(StudyTopic.id)).where(
                StudyTopic.is_completed.is_(True), StudyTopic.completed_at >= lo
            )
        )
        or 0
    )
    tasks_block = DashTasks(
        completed_today=completed_today,
        pending=len(pending_topics),
        items=[study.to_topic_out(t, actual.get(t.id, 0), today) for t in pending_topics[:6]],
    )

    # ---- goals
    goals = [g for g in db.scalars(select(DailyGoal).where(DailyGoal.goal_date == today).order_by(DailyGoal.sort_order, DailyGoal.created_at)).all()]
    done = sum(1 for g in goals if g.is_completed)
    goals_block = DashGoals(
        total=len(goals),
        completed=done,
        pct=int(done * 100 / len(goals)) if goals else 0,
        items=[DashGoal(id=g.id, title=g.title, is_completed=g.is_completed, category=g.category) for g in goals],
    )

    # ---- habits
    habit_items = habits.list_habits(db, today)
    habits_done = sum(1 for h in habit_items if h.is_done)
    habits_block = DashHabits(
        total=len(habit_items),
        completed=habits_done,
        pct=int(habits_done * 100 / len(habit_items)) if habit_items else 0,
        items=habit_items,
    )

    # ---- week overview (Mon..Sun)
    week_start, week_end = dates.week_bounds(today)
    week_days = dates.date_range(week_start, week_end)
    minutes_by_day = dict(
        db.execute(
            select(StudySession.session_date, func.sum(StudySession.duration_minutes))
            .where(StudySession.session_date.between(week_start, week_end))
            .group_by(StudySession.session_date)
        ).all()
    )
    goal_rows = db.execute(
        select(DailyGoal.goal_date, DailyGoal.is_completed).where(DailyGoal.goal_date.between(week_start, week_end))
    ).all()
    sleep_by_day = dict(
        db.execute(
            select(SleepRecord.sleep_date, SleepRecord.duration_minutes).where(
                SleepRecord.sleep_date.between(week_start, week_end)
            )
        ).all()
    )
    week_report = habits.report(db, "week", today)
    habit_done_by_day = {row["date"]: row["done"] for row in week_report.daily}
    week = []
    for d in week_days:
        gl = [c for gd, c in goal_rows if gd == d]
        week.append(
            DashWeekDay(
                date=d,
                weekday=d.strftime("%a"),
                study_minutes=int(minutes_by_day.get(d, 0) or 0),
                goals_completed=sum(1 for c in gl if c),
                goals_total=len(gl),
                habits_completed=habit_done_by_day.get(d.isoformat(), 0),
                sleep_minutes=sleep_by_day.get(d),
                is_today=d == today,
                is_future=d > today,
            )
        )

    # ---- garden, mood, message, upcoming
    g = garden.get_garden(db)
    mood_entry = mood.get_by_date(db, today)
    msg = surprises.daily_surprise(db, ("motivation",), mark_shown=False)

    return Dashboard(
        date=today,
        display_name=cfg.display_name,
        part_of_day=dates.part_of_day(now.hour),
        study=study_block,
        sleep=sleep_block,
        tasks=tasks_block,
        goals=goals_block,
        habits=habits_block,
        mood_today=mood.to_out(mood_entry) if mood_entry else None,
        reflection_done_today=journal.get_reflection(db, today) is not None,
        week=week,
        garden=DashGarden(
            level=g.level,
            total_xp=g.total_xp,
            xp_into_level=g.xp_into_level,
            xp_for_next_level=g.xp_for_next_level,
            progress_pct=g.progress_pct,
            xp_today=g.xp_today,
            unlocked_count=g.unlocked_count,
        ),
        message=DashMessage(id=msg.id, kind=msg.kind, content=msg.content, emoji=msg.emoji) if msg else None,
        upcoming=calendar.upcoming(db, 14)[:5],
        carry_forward_count=len(study.carry_forward_candidates(db)),
        ai_available=get_settings().ai_configured and cfg.ai_enabled,
    )
