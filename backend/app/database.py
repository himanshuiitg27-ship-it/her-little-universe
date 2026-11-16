import logging
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_engine_kwargs: dict = {"pool_pre_ping": True}
if settings.is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    logger.warning(
        "Using local SQLite database (%s). Set DATABASE_URL to your Neon PostgreSQL URL for real use.",
        settings.database_url,
    )
else:
    # Neon suspends idle compute; recycle connections so stale ones are never reused.
    _engine_kwargs.update(pool_recycle=300, pool_size=5, max_overflow=5)

engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
