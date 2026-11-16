from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.ai import service as svc
from app.database import get_db
from app.schemas.ai import (
    AIStatus,
    ApplyPlanRequest,
    ApplyPlanResult,
    AssistantReply,
    AssistantRequest,
    MotivationReply,
    MotivationRequest,
    PlanRequest,
    ReflectReply,
    ReflectRequest,
    StudyPlan,
    WeeklySummary,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status", response_model=AIStatus)
def ai_status(db: Session = Depends(get_db)):
    return svc.status(db)


@router.post("/study-plan", response_model=StudyPlan)
def study_plan(data: PlanRequest, db: Session = Depends(get_db)):
    return svc.build_study_plan(db, data)


@router.post("/study-plan/apply", response_model=ApplyPlanResult)
def apply_plan(data: ApplyPlanRequest, db: Session = Depends(get_db)):
    return svc.apply_plan(db, data)


@router.post("/assistant", response_model=AssistantReply)
def assistant(data: AssistantRequest, db: Session = Depends(get_db)):
    return AssistantReply(reply=svc.study_assistant(db, data))


@router.post("/weekly-summary", response_model=WeeklySummary)
def weekly_summary(db: Session = Depends(get_db)):
    return svc.weekly_summary(db)


@router.post("/motivation", response_model=MotivationReply)
def motivation(data: MotivationRequest, db: Session = Depends(get_db)):
    return MotivationReply(message=svc.motivation(db, data))


@router.post("/reflect", response_model=ReflectReply)
def reflect(data: ReflectRequest, db: Session = Depends(get_db)):
    return ReflectReply(reflection=svc.reflect(db, data))
