import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import StudySession, StudyTopic
from app.schemas.common import Rewards
from app.schemas.study import (
    CarryForwardResult,
    PrioritizedTopic,
    SessionCreate,
    SessionOut,
    StudyAnalytics,
    TopicCreate,
    TopicOut,
    TopicUpdate,
)
from app.services import dates, garden
from app.services.settings import get_settings_row

PRIORITY_WEIGHT = {"high": 3, "medium": 2, "low": 1}

# ------------------------------------------------------------------ topics


def get_topic(db: Session, topic_id: uuid.UUID) -> StudyTopic:
    topic = db.get(StudyTopic, topic_id)
    if topic is None:
        raise NotFoundError("Study topic not found")
    return topic


def _actual_minutes(db: Session, topic_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not topic_ids:
        return {}
    rows = db.execute(
        select(StudySession.topic_id, func.sum(StudySession.duration_minutes))
        .where(StudySession.topic_id.in_(topic_ids))
        .group_by(StudySession.topic_id)
    ).all()
    return {tid: int(total or 0) for tid, total in rows}


def to_topic_out(topic: StudyTopic, actual: int, today: date | None = None) -> TopicOut:
    today = today or dates.today()
    out = TopicOut.model_validate(topic)
    out.actual_minutes = actual
    out.is_overdue = bool(topic.deadline and topic.deadline < today and not topic.is_completed)
    return out


def list_topics(
    db: Session, status: str = "all", subject: str | None = None, planned_date: date | None = None
) -> list[TopicOut]:
    stmt = select(StudyTopic)
    if status == "pending":
        stmt = stmt.where(StudyTopic.is_completed.is_(False))
    elif status == "completed":
        stmt = stmt.where(StudyTopic.is_completed.is_(True))
    if subject:
        stmt = stmt.where(StudyTopic.subject == subject)
    if planned_date:
        stmt = stmt.where(StudyTopic.planned_date == planned_date)
    # Pending first, nearest deadline first (no deadline last), then newest.
    stmt = stmt.order_by(
        StudyTopic.is_completed,
        StudyTopic.deadline.is_(None),
        StudyTopic.deadline,
        StudyTopic.created_at.desc(),
    )
    topics = list(db.scalars(stmt).all())
    actual = _actual_minutes(db, [t.id for t in topics])
    today = dates.today()
    return [to_topic_out(t, actual.get(t.id, 0), today) for t in topics]


def topic_out(db: Session, topic: StudyTopic) -> TopicOut:
    return to_topic_out(topic, _actual_minutes(db, [topic.id]).get(topic.id, 0))


def create_topic(db: Session, data: TopicCreate) -> TopicOut:
    topic = StudyTopic(**data.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic_out(db, topic)


def update_topic(db: Session, topic_id: uuid.UUID, data: TopicUpdate) -> tuple[TopicOut, Rewards | None]:
    topic = get_topic(db, topic_id)
    changes = data.model_dump(exclude_unset=True)
    completing = changes.pop("is_completed", None)
    for key, value in changes.items():
        if value is None and key in ("title", "priority", "estimated_minutes"):
            continue
        setattr(topic, key, value)
    if completing is not None and completing != topic.is_completed:
        topic.is_completed = completing
        topic.completed_at = dates.now() if completing else None
    db.commit()
    db.refresh(topic)

    rewards = None
    if topic.is_completed:
        rewards = garden.record_events(db, [("topic_completed", str(topic.id), dates.today())])
    return topic_out(db, topic), rewards


def delete_topic(db: Session, topic_id: uuid.UUID) -> None:
    db.delete(get_topic(db, topic_id))
    db.commit()


# ------------------------------------------------------------------ prioritisation


def score_topic(topic: StudyTopic, remaining_minutes: int, today: date) -> tuple[int, list[str]]:
    """Transparent priority score: importance + deadline urgency + a nudge for started work."""
    score = PRIORITY_WEIGHT.get(topic.priority, 2) * 10
    reasons = [f"{topic.priority.capitalize()} priority"]
    if topic.deadline:
        days_left = (topic.deadline - today).days
        if days_left < 0:
            score += 45
            reasons.append(f"Overdue by {-days_left} day{'s' if days_left != -1 else ''}")
        elif days_left == 0:
            score += 40
            reasons.append("Due today")
        elif days_left <= 2:
            score += 32
            reasons.append(f"Due in {days_left} day{'s' if days_left != 1 else ''}")
        elif days_left <= 7:
            score += 20
            reasons.append(f"Due in {days_left} days")
        elif days_left <= 14:
            score += 10
            reasons.append(f"Due in {days_left} days")
        # Heavy topics with little time left deserve attention sooner.
        if days_left >= 0 and remaining_minutes > 0 and days_left <= 7 and remaining_minutes / max(days_left, 1) >= 120:
            score += 8
            reasons.append("Needs a big chunk of time")
    if remaining_minutes < topic.estimated_minutes:
        score += 5
        reasons.append("Already started")
    return score, reasons


def prioritized_topics(db: Session, limit: int | None = None) -> list[PrioritizedTopic]:
    today = dates.today()
    pending = list(db.scalars(select(StudyTopic).where(StudyTopic.is_completed.is_(False))).all())
    actual = _actual_minutes(db, [t.id for t in pending])
    ranked: list[PrioritizedTopic] = []
    for t in pending:
        done = actual.get(t.id, 0)
        score, reasons = score_topic(t, max(t.estimated_minutes - done, 0), today)
        ranked.append(PrioritizedTopic(topic=to_topic_out(t, done, today), score=score, reasons=reasons))
    ranked.sort(key=lambda p: (-p.score, p.topic.deadline or date.max))
    return ranked[:limit] if limit else ranked


# ------------------------------------------------------------------ carry forward (user controlled)


def carry_forward_candidates(db: Session) -> list[TopicOut]:
    """Unfinished topics that were planned for an earlier day. Nothing moves until she says so."""
    today = dates.today()
    topics = list(
        db.scalars(
            select(StudyTopic)
            .where(StudyTopic.is_completed.is_(False), StudyTopic.planned_date < today)
            .order_by(StudyTopic.planned_date)
        ).all()
    )
    actual = _actual_minutes(db, [t.id for t in topics])
    return [to_topic_out(t, actual.get(t.id, 0), today) for t in topics]


def carry_forward(db: Session, topic_ids: list[uuid.UUID], target: date | None) -> CarryForwardResult:
    target = target or dates.today()
    topics = db.scalars(
        select(StudyTopic).where(StudyTopic.id.in_(topic_ids), StudyTopic.is_completed.is_(False))
    ).all()
    for t in topics:
        t.planned_date = target
    db.commit()
    return CarryForwardResult(moved=len(topics), target_date=target)


# ------------------------------------------------------------------ sessions


def _session_out(session: StudySession, title: str | None) -> SessionOut:
    out = SessionOut.model_validate(session)
    out.topic_title = title
    return out


def create_session(db: Session, data: SessionCreate) -> tuple[SessionOut, Rewards]:
    title = None
    if data.topic_id:
        title = get_topic(db, data.topic_id).title
    started = data.started_at
    day = data.session_date or (dates.to_local(started).date() if started else dates.today())
    session = StudySession(
        topic_id=data.topic_id,
        session_date=day,
        started_at=started,
        duration_minutes=data.duration_minutes,
        kind=data.kind,
        notes=data.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    xp = max(1, min(20, data.duration_minutes // 5))
    rewards = garden.record_events(db, [("study_session", str(session.id), day, xp)])
    return _session_out(session, title), rewards


def list_sessions(db: Session, start: date | None = None, end: date | None = None, limit: int = 200) -> list[SessionOut]:
    day_start = start or dates.today()
    day_end = end or day_start
    rows = db.execute(
        select(StudySession, StudyTopic.title)
        .outerjoin(StudyTopic, StudyTopic.id == StudySession.topic_id)
        .where(StudySession.session_date.between(day_start, day_end))
        .order_by(StudySession.session_date.desc(), StudySession.created_at.desc())
        .limit(limit)
    ).all()
    return [_session_out(s, title) for s, title in rows]


def delete_session(db: Session, session_id: uuid.UUID) -> None:
    session = db.get(StudySession, session_id)
    if session is None:
        raise NotFoundError("Study session not found")
    db.delete(session)
    db.commit()


# ------------------------------------------------------------------ analytics


def analytics(db: Session, period: str, anchor: date | None = None) -> StudyAnalytics:
    anchor = anchor or dates.today()
    if period == "day":
        start = end = anchor
    elif period == "week":
        start, end = dates.week_bounds(anchor)
    else:
        start, end = dates.month_bounds(anchor)

    rows = db.execute(
        select(StudySession.session_date, StudySession.duration_minutes, StudyTopic.subject)
        .outerjoin(StudyTopic, StudyTopic.id == StudySession.topic_id)
        .where(StudySession.session_date.between(start, end))
    ).all()
    per_day: dict[date, int] = {d: 0 for d in dates.date_range(start, end)}
    per_subject: dict[str, int] = {}
    for d, minutes, subject in rows:
        per_day[d] += minutes
        key = subject or "General"
        per_subject[key] = per_subject.get(key, 0) + minutes

    total = sum(per_day.values())
    active = [d for d, m in per_day.items() if m > 0]
    best = max(per_day, key=per_day.get) if active else None

    lo = datetime.combine(start, datetime.min.time(), tzinfo=dates.app_tz())
    hi = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=dates.app_tz())
    topics_done = int(
        db.scalar(
            select(func.count(StudyTopic.id)).where(
                StudyTopic.is_completed.is_(True), StudyTopic.completed_at >= lo, StudyTopic.completed_at < hi
            )
        )
        or 0
    )
    return StudyAnalytics(
        period=period,
        start=start,
        end=end,
        total_minutes=total,
        sessions_count=len(rows),
        active_days=len(active),
        average_minutes_per_active_day=int(total / len(active)) if active else 0,
        best_day=best,
        topics_completed=topics_done,
        goal_minutes_per_day=get_settings_row(db).daily_study_goal_minutes,
        days=[{"date": d.isoformat(), "minutes": m} for d, m in per_day.items()],
        by_subject=sorted(
            ({"subject": s, "minutes": m} for s, m in per_subject.items()), key=lambda x: -x["minutes"]
        ),
    )
