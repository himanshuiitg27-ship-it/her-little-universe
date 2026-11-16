import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.schemas.rewards import SurpriseCreate, SurpriseOut, SurpriseUpdate
from app.services import surprises as svc

router = APIRouter(prefix="/surprises", tags=["surprises"])

Kind = Literal["motivation", "compliment", "hug", "special"]


@router.get("", response_model=list[SurpriseOut])
def list_surprises(kind: Kind | None = None, custom_only: bool = False, db: Session = Depends(get_db)):
    return svc.list_surprises(db, kind, custom_only)


@router.post("", response_model=SurpriseOut, status_code=201)
def create_surprise(data: SurpriseCreate, db: Session = Depends(get_db)):
    return svc.create_surprise(db, data)


@router.get("/daily", response_model=SurpriseOut)
def daily(db: Session = Depends(get_db)):
    s = svc.daily_surprise(db)
    if s is None:
        raise NotFoundError("No surprises are switched on. Turn some on or add your own!")
    return s


@router.get("/random", response_model=SurpriseOut)
def random_surprise(kind: Kind | None = None, db: Session = Depends(get_db)):
    s = svc.random_surprise(db, kind)
    if s is None:
        raise NotFoundError("No surprises of that kind are switched on.")
    return s


@router.patch("/{surprise_id}", response_model=SurpriseOut)
def update_surprise(surprise_id: uuid.UUID, data: SurpriseUpdate, db: Session = Depends(get_db)):
    return svc.update_surprise(db, surprise_id, data)


@router.delete("/{surprise_id}", status_code=204)
def delete_surprise(surprise_id: uuid.UUID, db: Session = Depends(get_db)):
    svc.delete_surprise(db, surprise_id)
    return Response(status_code=204)
