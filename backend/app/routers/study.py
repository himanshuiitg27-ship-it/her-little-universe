import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers._common import attach_rewards
from app.schemas.study import (
    CarryForwardRequest,
    CarryForwardResult,
    PrioritizedTopic,
    SessionCreate,
    SessionOut,
    SessionWithRewards,
    StudyAnalytics,
    TopicCreate,
    TopicOut,
    TopicUpdate,
    TopicWithRewards,
)
from app.services import study as svc

router = APIRouter(prefix="/study", tags=["study"])


@router.get("/topics", response_model=list[TopicOut])
def list_topics(
    status: Literal["all", "pending", "completed"] = "all",
    subject: str | None = None,
    planned_date: date | None = None,
    db: Session = Depends(get_db),
):
    return svc.list_topics(db, status, subject, planned_date)


@router.post("/topics", response_model=TopicOut, status_code=201)
def create_topic(data: TopicCreate, db: Session = Depends(get_db)):
    return svc.create_topic(db, data)


@router.patch("/topics/{topic_id}", response_model=TopicWithRewards)
def update_topic(topic_id: uuid.UUID, data: TopicUpdate, db: Session = Depends(get_db)):
    topic, rewards = svc.update_topic(db, topic_id, data)
    return attach_rewards(TopicWithRewards, topic, rewards)


@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(topic_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_topic(db, topic_id)
    return Response(status_code=204)


@router.get("/prioritized", response_model=list[PrioritizedTopic])
def prioritized(limit: int | None = Query(default=None, ge=1, le=50), db: Session = Depends(get_db)):
    return svc.prioritized_topics(db, limit)


@router.get("/carry-forward", response_model=list[TopicOut])
def carry_forward_candidates(db: Session = Depends(get_db)):
    return svc.carry_forward_candidates(db)


@router.post("/carry-forward", response_model=CarryForwardResult)
def carry_forward(data: CarryForwardRequest, db: Session = Depends(get_db)):
    return svc.carry_forward(db, data.topic_ids, data.target_date)


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)):
    return svc.list_sessions(db, start, end)


@router.post("/sessions", response_model=SessionWithRewards, status_code=201)
def create_session(data: SessionCreate, db: Session = Depends(get_db)):
    session, rewards = svc.create_session(db, data)
    return attach_rewards(SessionWithRewards, session, rewards)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_session(db, session_id)
    return Response(status_code=204)


@router.get("/analytics", response_model=StudyAnalytics)
def analytics(
    period: Literal["day", "week", "month"] = "week", anchor: date | None = None, db: Session = Depends(get_db)
):
    return svc.analytics(db, period, anchor)
