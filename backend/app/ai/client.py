"""Single place that knows how to talk to the LLM provider.

Swap providers or models here (or via env vars) without touching features.
"""

import logging

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from pydantic import SecretStr

from app.config import get_settings
from app.exceptions import AIProviderError, AIUnavailableError

logger = logging.getLogger(__name__)


def ai_unavailable_reason() -> str | None:
    s = get_settings()
    if not s.ai_enabled:
        return "AI features are switched off on the server (AI_ENABLED=false)."
    if not s.groq_api_key.strip():
        return "AI isn't set up yet. Add GROQ_API_KEY to the backend .env file and restart the server."
    return None


def get_llm(temperature: float | None = None) -> BaseChatModel:
    reason = ai_unavailable_reason()
    if reason:
        raise AIUnavailableError(reason)
    from langchain_groq import ChatGroq  # imported lazily so the app boots without it configured

    s = get_settings()
    return ChatGroq(
        model=s.groq_model,
        api_key=SecretStr(s.groq_api_key),
        temperature=s.ai_temperature if temperature is None else temperature,
        timeout=s.ai_timeout_seconds,
        max_retries=s.ai_max_retries,
    )


def invoke(llm: BaseChatModel, messages: list[BaseMessage]) -> str:
    """Call the model and return plain text, mapping provider failures to a friendly API error."""
    try:
        result = llm.invoke(messages)
    except Exception as exc:  # network, auth, rate limit, bad model name...
        logger.exception("LLM call failed")
        name = type(exc).__name__
        if "auth" in name.lower() or "401" in str(exc):
            raise AIProviderError("The AI service rejected the API key. Please check GROQ_API_KEY.") from exc
        if "ratelimit" in name.lower() or "429" in str(exc):
            raise AIProviderError("The AI service is busy right now. Please try again in a minute.") from exc
        raise AIProviderError("The AI service couldn't answer right now. Please try again.") from exc
    content = result.content
    if isinstance(content, list):  # some providers return content blocks
        content = "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content)
    return str(content).strip()


def ask(llm: BaseChatModel, system: str, user: str) -> str:
    return invoke(llm, [SystemMessage(content=system), HumanMessage(content=user)])
