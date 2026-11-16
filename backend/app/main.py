import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal, get_db
from app.exceptions import register_exception_handlers
from app.logging_config import configure_logging
from app.routers import (
    achievements,
    ai,
    calendar,
    dashboard,
    garden,
    goals,
    habits,
    journal,
    mood,
    reminders,
    sleep,
    study,
    surprises,
)
from app.routers import settings as settings_router
from app.services.seed import seed_defaults

configure_logging()
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    logger.info(
        "Starting Her Little Universe (env=%s, db=%s, ai=%s)",
        settings.environment,
        "sqlite" if settings.is_sqlite else "postgresql",
        "on" if settings.ai_configured else "off (no GROQ_API_KEY)",
    )
    try:
        with SessionLocal() as db:
            seed_defaults(db)
    except Exception:
        logger.exception(
            "Could not prepare the database. Have you run `alembic upgrade head`? The API will start, "
            "but requests will fail until the schema exists."
        )
    yield


app = FastAPI(
    title="Her Little Universe API",
    version="1.0.0",
    description="Private productivity, wellness and happiness companion.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)

api = APIRouter(prefix="/api")


@api.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "sqlite" if get_settings().is_sqlite else "postgresql"}


for module in (
    settings_router,
    dashboard,
    goals,
    study,
    sleep,
    habits,
    mood,
    journal,
    garden,
    surprises,
    achievements,
    calendar,
    reminders,
    ai,
):
    api.include_router(module.router)

app.include_router(api)
