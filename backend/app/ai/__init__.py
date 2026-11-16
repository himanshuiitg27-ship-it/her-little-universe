"""AI layer (Groq via LangChain, LangGraph for multi-step workflows).

Kept separate from the CRUD code on purpose: nothing outside `app.ai` and `routers/ai.py`
imports an LLM, and every feature works (without AI) when no API key is configured.
"""
