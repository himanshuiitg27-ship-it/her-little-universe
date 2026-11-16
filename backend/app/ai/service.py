"""Orchestrates AI features: gathers real data from the database, calls the model, stores results.

Ordinary CRUD never goes through here. Each public function = one AI feature.
"""

import logging
import uuid
from datetime import date

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from sqlalchemy.orm import Session

from app.ai import client, prompts
from app.ai.planner_graph import build_graph
from app.config import get_settings
from app.exceptions import AIUnavailableError, NotFoundError, ValidationFailed
from app.models import MoodEntry
from app.models import StudyTopic as StudyTopicModel
from app.schemas.ai import (
    AIStatus,
    ApplyPlanRequest,
    ApplyPlanResult,
    AssistantRequest,
    MotivationRequest,
    PlanBlock,
    PlanDay,
    PlanRequest,
    PlanUnscheduled,
    ReflectRequest,
    StudyPlan,
    WeeklySummary,
)
from app.services import dates, goals, habits, journal, mood, sleep, study
from app.services.settings import get_settings_row

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ availability


def status(db: Session) -> AIStatus:
    cfg = get_settings()
    row = get_settings_row(db)
    reason = client.ai_unavailable_reason()
    if reason is None and not row.ai_enabled:
        reason = "AI is switched off in your settings."
    return AIStatus(
        configured=cfg.ai_configured,
        enabled=reason is None,
        model=cfg.groq_model if cfg.ai_configured else None,
        reason=reason,
    )


def _llm(db: Session, temperature: float | None = None):
    if not get_settings_row(db).ai_enabled:
        raise AIUnavailableError("AI is switched off in your settings.")
    return client.get_llm(temperature)


# ------------------------------------------------------------------ study planner (LangGraph)


def build_study_plan(db: Session, req: PlanRequest) -> StudyPlan:
    llm = _llm(db, temperature=0.3)
    today = dates.today()
    start = req.start_date or today
    if start < today:
        raise ValidationFailed("The plan can't start in the past")
    daily = req.daily_minutes or get_settings_row(db).daily_study_goal_minutes

    ranked = study.prioritized_topics(db)
    if req.topic_ids:
        wanted = set(req.topic_ids)
        ranked = [p for p in ranked if p.topic.id in wanted]
    ranked = ranked[:25]
    if not ranked:
        raise ValidationFailed("There are no pending study topics to plan yet. Add a few topics first.")

    topics = []
    for i, p in enumerate(ranked, start=1):
        t = p.topic
        topics.append(
            {
                "code": f"T{i}",
                "id": str(t.id),
                "title": t.title,
                "subject": t.subject,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "left": max(t.estimated_minutes - t.actual_minutes, 15),
                "priority": t.priority,
            }
        )

    graph = build_graph(llm)
    result = graph.invoke(
        {
            "today": today.isoformat(),
            "start": start.isoformat(),
            "days": req.days,
            "daily_minutes": daily,
            "notes": (req.notes or "").strip(),
            "topics": topics,
        }
    )
    plan = result["plan"]
    by_code = {t["code"]: t for t in topics}

    days = []
    for d in plan["days"]:
        blocks = [
            PlanBlock(
                topic_id=uuid.UUID(by_code[b["code"]]["id"]),
                title=by_code[b["code"]]["title"],
                subject=by_code[b["code"]]["subject"],
                minutes=b["minutes"],
                focus=b["focus"] or None,
            )
            for b in d["blocks"]
        ]
        days.append(
            PlanDay(
                date=date.fromisoformat(d["date"]),
                total_minutes=sum(b.minutes for b in blocks),
                tip=d["tip"] or None,
                blocks=blocks,
            )
        )
    return StudyPlan(
        source=plan["source"],
        summary=plan["summary"],
        days=days,
        unscheduled=[
            PlanUnscheduled(
                topic_id=uuid.UUID(by_code[u["code"]]["id"]), title=by_code[u["code"]]["title"], reason=u["reason"]
            )
            for u in plan["unscheduled"]
        ],
        warnings=plan["warnings"],
        attempts=plan["attempts"],
        daily_minutes=daily,
    )


def apply_plan(db: Session, req: ApplyPlanRequest) -> ApplyPlanResult:
    """Writes the chosen planned date onto each topic (only when she presses 'Use this plan')."""
    earliest: dict[uuid.UUID, date] = {}
    for a in req.assignments:
        if a.topic_id not in earliest or a.date < earliest[a.topic_id]:
            earliest[a.topic_id] = a.date
    updated = 0
    for topic_id, day in earliest.items():
        topic = db.get(StudyTopicModel, topic_id)
        if topic is None or topic.is_completed:
            continue
        topic.planned_date = day
        updated += 1
    db.commit()
    return ApplyPlanResult(updated=updated)


# ------------------------------------------------------------------ study assistant


def study_assistant(db: Session, req: AssistantRequest) -> str:
    llm = _llm(db, temperature=0.5)
    system = prompts.STUDY_ASSISTANT
    if req.topic_id:
        topic = db.get(StudyTopicModel, req.topic_id)
        if topic is None:
            raise NotFoundError("Study topic not found")
        system += f' She is currently studying: "{topic.title}"' + (f" ({topic.subject})." if topic.subject else ".")
    history: list[BaseMessage] = [SystemMessage(content=system)]
    for m in req.messages[-12:]:
        history.append(HumanMessage(content=m.content) if m.role == "user" else AIMessage(content=m.content))
    if not isinstance(history[-1], HumanMessage):
        raise ValidationFailed("The last message must be from you")
    return client.invoke(llm, history)


# ------------------------------------------------------------------ weekly summary


def weekly_summary(db: Session) -> WeeklySummary:
    llm = _llm(db, temperature=0.6)
    today = dates.today()
    start, end = dates.week_bounds(today)
    st = study.analytics(db, "week", today)
    sl = sleep.analytics(db, "week", today)
    hb = habits.report(db, "week", today)
    md = mood.trends(db, 7)
    week_goals = [g for d in dates.date_range(start, min(end, today)) for g in goals.list_goals(db, d)]
    stats = {
        "study_hours": round(st.total_minutes / 60, 1),
        "study_days_active": st.active_days,
        "study_goal_hours_per_day": round(st.goal_minutes_per_day / 60, 1),
        "topics_completed": st.topics_completed,
        "top_subjects": [s["subject"] for s in st.by_subject[:3]],
        "goals_completed": sum(1 for g in week_goals if g.is_completed),
        "goals_total": len(week_goals),
        "habit_completion_pct": hb.overall_pct,
        "best_habit": max(hb.habits, key=lambda h: h.days_done).name if hb.habits and any(h.days_done for h in hb.habits) else None,
        "sleep_nights_logged": sl.records_count,
        "average_sleep_hours": round(sl.average_minutes / 60, 1) if sl.average_minutes else None,
        "sleep_goal_hours": round(sl.goal_minutes / 60, 1),
        "sleep_consistency": sl.consistency_label,
        "mood_check_ins": md.entries_count,
        "average_mood_out_of_5": md.average_score,
    }
    user = "Her week so far (Monday to today):\n" + "\n".join(f"- {k}: {v}" for k, v in stats.items() if v not in (None, [], 0, 0.0))
    text = client.ask(llm, prompts.WEEKLY_SUMMARY, user)
    return WeeklySummary(summary=text, week_start=start, week_end=end, stats=stats)


# ------------------------------------------------------------------ motivation


def motivation(db: Session, req: MotivationRequest) -> str:
    llm = _llm(db, temperature=0.9)
    today = dates.today()
    cfg = get_settings_row(db)
    st = study.analytics(db, "day", today)
    todays_goals = goals.list_goals(db, today)
    m = mood.get_by_date(db, today)
    facts = [
        f"Part of day: {dates.part_of_day(dates.now().hour)}",
        f"Name: {cfg.display_name}" if cfg.display_name else None,
        f"Studied today: {st.total_minutes} minutes" if st.total_minutes else None,
        f"Goals done today: {sum(1 for g in todays_goals if g.is_completed)} of {len(todays_goals)}" if todays_goals else None,
        f"Mood today: {m.mood}" if m else None,
        f"She asked for help with: {req.focus}" if req.focus else None,
    ]
    return client.ask(llm, prompts.MOTIVATION, "Snapshot:\n" + "\n".join(f"- {f}" for f in facts if f))


# ------------------------------------------------------------------ journal / mood reflection


def _needs_care(text: str) -> bool:
    lowered = text.lower()
    return any(k in lowered for k in prompts.CARE_KEYWORDS)


def reflect(db: Session, req: ReflectRequest) -> str:
    llm = _llm(db, temperature=0.7)
    if req.source == "mood":
        entry = db.get(MoodEntry, req.id)
        if entry is None:
            raise NotFoundError("Mood entry not found")
        meta = mood.MOODS_BY_KEY.get(entry.mood)
        text = f"Mood: {meta.label if meta else entry.mood}\nNote: {entry.note or '(no note)'}"
    else:
        entry = journal.get_entry(db, req.id, "journal" if req.source == "journal" else "reflection")
        if req.source == "journal":
            text = f"Title: {entry.title or '(none)'}\n{entry.content or ''}"
        else:
            text = "\n".join(
                f"{label}: {value}"
                for label, value in (
                    ("What made me happy today", entry.happy_moment),
                    ("What I accomplished", entry.accomplishment),
                    ("What I can improve tomorrow", entry.improvement),
                    ("What I'm grateful for", entry.gratitude),
                )
                if value
            )
    if not text.strip():
        raise ValidationFailed("There's nothing written to reflect on yet")

    reply = client.ask(llm, prompts.REFLECTION, f"Her entry:\n{text}")
    if _needs_care(text) and prompts.CARE_NOTE.strip() not in reply:
        reply += prompts.CARE_NOTE
    entry.ai_reflection = reply
    db.commit()
    return reply
