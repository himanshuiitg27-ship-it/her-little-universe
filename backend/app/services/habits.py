import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import Habit, HabitLog
from app.schemas.common import Rewards
from app.schemas.core import HabitCreate, HabitReport, HabitReportRow, HabitToday, HabitUpdate
from app.services import calc, dates, garden


def get_habit(db: Session, habit_id: uuid.UUID) -> Habit:
    habit = db.get(Habit, habit_id)
    if habit is None:
        raise NotFoundError("Habit not found")
    return habit


def _decorate(habit: Habit, day: date, logs: dict[date, int]) -> HabitToday:
    done_dates = {d for d, c in logs.items() if c >= habit.target_count}
    current, longest = calc.compute_streaks(done_dates, day)
    count = logs.get(day, 0)
    last7 = [(day - timedelta(days=i)) in done_dates for i in range(6, -1, -1)]
    return HabitToday(
        id=habit.id,
        created_at=habit.created_at,
        updated_at=habit.updated_at,
        name=habit.name,
        emoji=habit.emoji,
        category=habit.category,
        target_count=habit.target_count,
        unit=habit.unit,
        is_active=habit.is_active,
        log_date=day,
        count=count,
        is_done=count >= habit.target_count,
        current_streak=current,
        longest_streak=longest,
        last_7_days=last7,
    )


def _logs_by_habit(db: Session, habit_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[date, int]]:
    result: dict[uuid.UUID, dict[date, int]] = {hid: {} for hid in habit_ids}
    if not habit_ids:
        return result
    for log in db.scalars(select(HabitLog).where(HabitLog.habit_id.in_(habit_ids))).all():
        result[log.habit_id][log.log_date] = log.count
    return result


def list_habits(db: Session, day: date | None = None, include_inactive: bool = False) -> list[HabitToday]:
    day = day or dates.today()
    stmt = select(Habit).order_by(Habit.sort_order, Habit.created_at)
    if not include_inactive:
        stmt = stmt.where(Habit.is_active.is_(True))
    habits = list(db.scalars(stmt).all())
    logs = _logs_by_habit(db, [h.id for h in habits])
    return [_decorate(h, day, logs[h.id]) for h in habits]


def create_habit(db: Session, data: HabitCreate) -> HabitToday:
    order = db.scalar(select(func.coalesce(func.max(Habit.sort_order), -1))) + 1
    habit = Habit(**data.model_dump(), sort_order=order)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return _decorate(habit, dates.today(), {})


def update_habit(db: Session, habit_id: uuid.UUID, data: HabitUpdate) -> HabitToday:
    habit = get_habit(db, habit_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None and key in ("name", "emoji", "target_count", "is_active"):
            continue
        setattr(habit, key, value)
    db.commit()
    db.refresh(habit)
    logs = _logs_by_habit(db, [habit.id])[habit.id]
    return _decorate(habit, dates.today(), logs)


def delete_habit(db: Session, habit_id: uuid.UUID) -> None:
    db.delete(get_habit(db, habit_id))
    db.commit()


def set_log(db: Session, habit_id: uuid.UUID, day: date, count: int) -> tuple[HabitToday, Rewards | None]:
    habit = get_habit(db, habit_id)
    log = db.scalar(select(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.log_date == day))
    if log is None:
        log = HabitLog(habit_id=habit_id, log_date=day, count=count)
        db.add(log)
    else:
        log.count = count
    db.commit()

    rewards = None
    if count >= habit.target_count:
        rewards = garden.record_events(db, [("habit_completed", f"{habit_id}:{day.isoformat()}", day)])
    logs = _logs_by_habit(db, [habit_id])[habit_id]
    return _decorate(habit, day, logs), rewards


def report(db: Session, period: str, anchor: date | None = None) -> HabitReport:
    anchor = anchor or dates.today()
    start, end = dates.week_bounds(anchor) if period == "week" else dates.month_bounds(anchor)
    # Only count days that have actually happened so the future never looks like a failure.
    last_day = min(end, dates.today())
    days = dates.date_range(start, last_day) if last_day >= start else []

    habits = list(db.scalars(select(Habit).where(Habit.is_active.is_(True)).order_by(Habit.sort_order)).all())
    logs = _logs_by_habit(db, [h.id for h in habits])

    rows: list[HabitReportRow] = []
    total_done = 0
    daily = {d: 0 for d in days}
    for h in habits:
        hl = logs[h.id]
        done_in_period = [d for d in days if hl.get(d, 0) >= h.target_count]
        for d in done_in_period:
            daily[d] += 1
        total_done += len(done_in_period)
        done_all = {d for d, c in hl.items() if c >= h.target_count}
        current, longest = calc.compute_streaks(done_all, dates.today())
        rows.append(
            HabitReportRow(
                habit_id=h.id,
                name=h.name,
                emoji=h.emoji,
                days_done=len(done_in_period),
                days_in_period=len(days),
                completion_pct=int(len(done_in_period) * 100 / len(days)) if days else 0,
                current_streak=current,
                longest_streak=longest,
            )
        )
    possible = len(days) * len(habits)
    return HabitReport(
        period=period,
        start=start,
        end=end,
        overall_pct=int(total_done * 100 / possible) if possible else 0,
        daily=[{"date": d.isoformat(), "done": daily[d], "total": len(habits)} for d in days],
        habits=rows,
    )
