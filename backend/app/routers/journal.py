import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.routers._common import attach_rewards
from app.schemas.core import JournalCreate, JournalOut, JournalUpdate, JournalWithRewards, ReflectionSet
from app.services import journal as svc

router = APIRouter(tags=["journal"])


@router.get("/journal", response_model=list[JournalOut])
def list_journal(
    start: date | None = None,
    end: date | None = None,
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return svc.list_entries(db, "journal", start, end, q, limit, offset)


@router.post("/journal", response_model=JournalWithRewards, status_code=201)
def create_journal(data: JournalCreate, db: Session = Depends(get_db)):
    entry, rewards = svc.create_journal(db, data)
    return attach_rewards(JournalWithRewards, entry, rewards)


@router.patch("/journal/{entry_id}", response_model=JournalOut)
def update_journal(entry_id: uuid.UUID, data: JournalUpdate, db: Session = Depends(get_db)):
    return svc.update_journal(db, entry_id, data)


@router.delete("/journal/{entry_id}", status_code=204)
def delete_journal(entry_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.get_entry(db, entry_id, "journal")
    svc.delete_entry(db, entry_id)
    return Response(status_code=204)


@router.get("/reflections", response_model=list[JournalOut])
def list_reflections(
    start: date | None = None,
    end: date | None = None,
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return svc.list_entries(db, "reflection", start, end, q, limit, offset)


@router.get("/reflections/{day}", response_model=JournalOut)
def get_reflection(day: date, db: Session = Depends(get_db)):
    entry = svc.get_reflection(db, day)
    if entry is None:
        raise NotFoundError("No reflection saved for that night yet")
    return entry


@router.put("/reflections/{day}", response_model=JournalWithRewards)
def save_reflection(day: date, data: ReflectionSet, db: Session = Depends(get_db)):
    entry, rewards = svc.save_reflection(db, day, data)
    return attach_rewards(JournalWithRewards, entry, rewards)


@router.delete("/reflections/{entry_id}", status_code=204)
def delete_reflection(entry_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.get_entry(db, entry_id, "reflection")
    svc.delete_entry(db, entry_id)
    return Response(status_code=204)
