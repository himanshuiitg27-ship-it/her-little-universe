"""Environment-based configuration. All secrets come from environment variables / .env."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"

    # Database -------------------------------------------------------------
    # Neon example: postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
    database_url: str = "sqlite:///./her_little_universe_local.db"

    # Behaviour -------------------------------------------------------------
    app_timezone: str = "Asia/Kolkata"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI (Groq) -------------------------------------------------------------
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    ai_enabled: bool = True
    ai_temperature: float = Field(default=0.6, ge=0.0, le=2.0)
    ai_timeout_seconds: int = 45
    ai_max_retries: int = 2

    @field_validator("database_url")
    @classmethod
    def normalise_database_url(cls, value: str) -> str:
        # Neon / Heroku style URLs use "postgres://" or "postgresql://"; pin the psycopg2 driver.
        if value.startswith("postgres://"):
            value = value.replace("postgres://", "postgresql+psycopg2://", 1)
        elif value.startswith("postgresql://"):
            value = value.replace("postgresql://", "postgresql+psycopg2://", 1)
        return value

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_configured(self) -> bool:
        return self.ai_enabled and bool(self.groq_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
