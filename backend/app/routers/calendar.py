import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.rewards import CalendarItem, CalendarMonth, EventCreate, EventOut, EventUpdate
from app.services import calendar as svc

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/month", response_model=CalendarMonth)
def month(year: int = Query(ge=2000, le=2100), month: int = Query(ge=1, le=12), db: Session = Depends(get_db)):
    return svc.month_view(db, year, month)


@router.get("/upcoming", response_model=list[CalendarItem])
def upcoming(days: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)):
    return svc.upcoming(db, days)


@router.post("/events", response_model=EventOut, status_code=201)
def create_event(data: EventCreate, db: Session = Depends(get_db)):
    return svc.create_event(db, data)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(event_id: uuid.UUID, data: EventUpdate, db: Session = Depends(get_db)):
    return svc.update_event(db, event_id, data)


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_event(db, event_id)
    return Response(status_code=204)
