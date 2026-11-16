import re
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import ValidationFailed
from app.schemas.rewards import AchievementList, MonthlySummary
from app.services import achievements as svc
from app.services import dates

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=AchievementList)
def list_achievements(db: Session = Depends(get_db)):
    return svc.list_achievements(db)


@router.get("/summary", response_model=MonthlySummary)
def monthly_summary(month: str | None = Query(default=None, description="YYYY-MM"), db: Session = Depends(get_db)):
    if month is None:
        anchor = dates.today()
    else:
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
            raise ValidationFailed("month must look like 2026-11")
        anchor = date(int(month[:4]), int(month[5:]), 1)
    return svc.monthly_summary(db, anchor)
