"""Test setup. Runs on a throw-away SQLite file by default.

To run the very same suite against PostgreSQL:
    TEST_DATABASE_URL=postgresql://user@localhost:5432/testdb pytest
(the target database's tables are dropped and recreated for every test, so use an empty test DB!)
"""

import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="hlu-tests-")
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{_tmp}/test.db"
os.environ["GROQ_API_KEY"] = ""
os.environ["APP_TIMEZONE"] = "Asia/Kolkata"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    # No `with` block: skips the startup seeding so each test starts from an empty database.
    return TestClient(app)


@pytest.fixture
def seeded_client():
    from app.database import SessionLocal
    from app.services.seed import seed_defaults

    with SessionLocal() as db:
        seed_defaults(db)
    return TestClient(app)


@pytest.fixture
def ai_on(monkeypatch):
    """Pretend a Groq key is configured; tests inject a fake model via the `fake_llm` fixture."""
    monkeypatch.setattr(get_settings(), "groq_api_key", "test-key")


@pytest.fixture
def fake_llm(monkeypatch, ai_on):
    from langchain_core.language_models.fake_chat_models import FakeListChatModel

    from app.ai import client as ai_client

    def install(responses: list[str]):
        model = FakeListChatModel(responses=responses)
        monkeypatch.setattr(ai_client, "get_llm", lambda temperature=None: model)
        return model

    return install
