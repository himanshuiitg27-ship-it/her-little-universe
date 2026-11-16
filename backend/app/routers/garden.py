from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.rewards import GardenOut
from app.services import garden as svc

router = APIRouter(prefix="/garden", tags=["garden"])


@router.get("", response_model=GardenOut)
def get_garden(db: Session = Depends(get_db)):
    return svc.get_garden(db)
