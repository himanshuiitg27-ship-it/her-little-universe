import json
import re

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def extract_json(text: str) -> dict:
    """Parse the first JSON object in an LLM reply, tolerating code fences and chatter."""
    cleaned = _FENCE.sub("", text.strip())
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("No JSON object found in the model reply") from None
        try:
            value = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError(f"Model reply was not valid JSON: {exc.msg}") from exc
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object")
    return value
