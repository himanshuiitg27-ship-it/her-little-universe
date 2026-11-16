from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.dashboard import Dashboard
from app.services import dashboard as svc

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=Dashboard)
def get_dashboard(db: Session = Depends(get_db)):
    return svc.build_dashboard(db)
