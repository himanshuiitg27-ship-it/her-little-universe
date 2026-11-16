import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers._common import attach_rewards
from app.schemas.core import MoodOption, MoodOut, MoodSet, MoodTrend, MoodWithRewards
from app.services import dates
from app.services import mood as svc

router = APIRouter(prefix="/mood", tags=["mood"])


@router.get("/options", response_model=list[MoodOption])
def options():
    return svc.MOODS


@router.get("/trends", response_model=MoodTrend)
def trends(days: int = Query(default=30, ge=7, le=365), db: Session = Depends(get_db)):
    return svc.trends(db, days)


@router.get("", response_model=list[MoodOut])
def list_entries(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)):
    end = end or dates.today()
    start = start or end - timedelta(days=29)
    return [svc.to_out(e) for e in svc.list_entries(db, start, end)]


@router.put("", response_model=MoodWithRewards)
def set_mood(data: MoodSet, db: Session = Depends(get_db)):
    entry, rewards = svc.set_mood(db, data)
    out = svc.to_out(entry)
    return attach_rewards(MoodWithRewards, out, rewards)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_entry(db, entry_id)
    return Response(status_code=204)
