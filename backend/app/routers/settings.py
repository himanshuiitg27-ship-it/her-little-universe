from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.core import SettingsOut, SettingsUpdate
from app.services import settings as svc

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def read_settings(db: Session = Depends(get_db)):
    return svc.get_settings_row(db)


@router.patch("", response_model=SettingsOut)
def patch_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    return svc.update_settings(db, data)
