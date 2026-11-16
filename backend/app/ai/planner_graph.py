"""LangGraph workflow that builds a realistic study schedule.

    prepare -> draft -> validate --(problems & retries left)--> revise -> validate
                                 \\--(ok, or out of retries)--> finalize -> END

* `prepare`   deterministic: dates, capacity, topic codes (T1..Tn) so the model can't mangle UUIDs
* `draft`     LLM writes a first plan as JSON
* `validate`  deterministic rules (known topics, capacity, deadlines, over-scheduling)
* `revise`    LLM repairs the plan using the concrete problems found
* `finalize`  deterministic clean-up; falls back to a greedy schedule if the model never
              produced usable JSON, and says so (source="fallback")

The LLM is injected, so the graph is unit-testable with a fake model.
"""

import json
import logging
from datetime import date, timedelta
from typing import Any, TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import END, START, StateGraph

from app.ai import client, prompts
from app.ai.jsonutil import extract_json

logger = logging.getLogger(__name__)

MAX_REVISIONS = 2
MIN_BLOCK = 10


class PlannerState(TypedDict, total=False):
    # inputs
    today: str
    start: str
    days: int
    daily_minutes: int
    notes: str
    topics: list[dict]  # {code, id, title, subject, deadline|None, left, priority}
    # working
    window: list[str]
    draft: dict | None
    raw: str
    issues: list[str]
    attempts: int
    # outputs
    plan: dict


# --------------------------------------------------------------------------- helpers


def _topic_lines(topics: list[dict]) -> str:
    lines = []
    for t in topics:
        deadline = t["deadline"] or "none"
        subject = f" [{t['subject']}]" if t.get("subject") else ""
        lines.append(f'{t["code"]}: "{t["title"]}"{subject} | priority {t["priority"]} | deadline {deadline} | left {t["left"]} min')
    return "\n".join(lines)


def _parse_blocks(draft: dict, by_code: dict[str, dict], window: set[str]) -> tuple[list[dict], list[str]]:
    """Flatten a draft into clean blocks; returns (blocks, structural_problems)."""
    problems: list[str] = []
    blocks: list[dict] = []
    days = draft.get("days")
    if not isinstance(days, list) or not days:
        return [], ['The plan must contain a non-empty "days" list.']
    for day in days:
        d = str(day.get("date", ""))[:10] if isinstance(day, dict) else ""
        if d not in window:
            problems.append(f"Date '{d}' is outside the allowed dates.")
            continue
        for b in day.get("blocks", []) or []:
            code = str(b.get("topic", "")).strip().upper()
            if code not in by_code:
                problems.append(f"Unknown topic code '{code}'. Use only the codes listed.")
                continue
            try:
                minutes = int(b.get("minutes", 0))
            except (TypeError, ValueError):
                problems.append(f"Block for {code} on {d} has a non-numeric minutes value.")
                continue
            if minutes < MIN_BLOCK:
                problems.append(f"Block for {code} on {d} is shorter than {MIN_BLOCK} minutes.")
                continue
            blocks.append({"date": d, "code": code, "minutes": minutes, "focus": str(b.get("focus") or "").strip()[:120], "tip": str(day.get("tip") or "").strip()[:160]})
    return blocks, problems


def _check(blocks: list[dict], by_code: dict[str, dict], daily: int) -> list[str]:
    issues: list[str] = []
    per_day: dict[str, int] = {}
    per_topic: dict[str, int] = {}
    for b in blocks:
        per_day[b["date"]] = per_day.get(b["date"], 0) + b["minutes"]
        per_topic[b["code"]] = per_topic.get(b["code"], 0) + b["minutes"]
        deadline = by_code[b["code"]]["deadline"]
        if deadline and b["date"] > deadline:
            issues.append(f"{b['code']} is scheduled on {b['date']}, after its deadline {deadline}.")
    for d, total in sorted(per_day.items()):
        if total > daily:
            issues.append(f"{d} has {total} minutes scheduled but the maximum is {daily}.")
    for code, total in per_topic.items():
        left = by_code[code]["left"]
        if total > left * 1.15 + 5:
            issues.append(f"{code} has {total} minutes scheduled but only {left} are needed.")
    return issues[:8]


def greedy_schedule(topics: list[dict], window: list[str], daily: int) -> list[dict]:
    """Deterministic fallback: most urgent first, fill each day up to capacity, respect deadlines."""
    remaining = {t["code"]: t["left"] for t in topics}
    blocks: list[dict] = []
    for d in window:
        capacity = daily
        for t in topics:
            if capacity < MIN_BLOCK:
                break
            if remaining[t["code"]] <= 0 or (t["deadline"] and d > t["deadline"]):
                continue
            chunk = min(remaining[t["code"]], capacity, 90)
            if chunk < MIN_BLOCK and remaining[t["code"]] > chunk:
                continue
            blocks.append({"date": d, "code": t["code"], "minutes": chunk, "focus": "", "tip": ""})
            remaining[t["code"]] -= chunk
            capacity -= chunk
    return blocks


# --------------------------------------------------------------------------- graph


def build_graph(llm: BaseChatModel):
    def prepare(state: PlannerState) -> PlannerState:
        start = date.fromisoformat(state["start"])
        window = [(start + timedelta(days=i)).isoformat() for i in range(state["days"])]
        return {"window": window, "attempts": 0, "issues": [], "draft": None, "raw": ""}

    def draft(state: PlannerState) -> PlannerState:
        window = state["window"]
        prompt = prompts.PLANNER_USER.format(
            today=state["today"],
            start=window[0],
            end=window[-1],
            days=len(window),
            dates=", ".join(window),
            daily=state["daily_minutes"],
            notes=state.get("notes") or "none",
            topics=_topic_lines(state["topics"]),
        )
        raw = client.ask(llm, prompts.PLANNER_SYSTEM, prompt)
        return {"raw": raw}

    def revise(state: PlannerState) -> PlannerState:
        issues = "\n".join(f"- {i}" for i in state["issues"])
        previous = json.dumps(state.get("draft") or {"unparseable_reply": state.get("raw", "")[:1500]})
        prompt = prompts.PLANNER_REVISE.format(issues=issues, plan=previous)
        raw = client.ask(llm, prompts.PLANNER_SYSTEM, prompt)
        return {"raw": raw, "attempts": state["attempts"] + 1}

    def validate(state: PlannerState) -> PlannerState:
        by_code = {t["code"]: t for t in state["topics"]}
        try:
            parsed = extract_json(state["raw"])
        except ValueError as exc:
            return {"draft": None, "issues": [f"Your reply was not valid JSON ({exc}). Return only the JSON object."]}
        blocks, problems = _parse_blocks(parsed, by_code, set(state["window"]))
        issues = problems + _check(blocks, by_code, state["daily_minutes"])
        return {"draft": parsed, "issues": issues[:8]}

    def route(state: PlannerState) -> str:
        if state["issues"] and state["attempts"] < MAX_REVISIONS:
            return "revise"
        return "finalize"

    def finalize(state: PlannerState) -> PlannerState:
        by_code = {t["code"]: t for t in state["topics"]}
        daily = state["daily_minutes"]
        warnings: list[str] = []
        summary = ""
        source = "ai"
        blocks: list[dict] = []

        if state.get("draft"):
            summary = str(state["draft"].get("summary") or "").strip()[:300]
            blocks, _ = _parse_blocks(state["draft"], by_code, set(state["window"]))
        if not blocks:
            source = "fallback"
            blocks = greedy_schedule(state["topics"], state["window"], daily)
            summary = "Here's a balanced plan built from your priorities and deadlines."
            warnings.append("The AI couldn't produce a usable plan, so a simple priority-based schedule was built instead.")

        # Deterministic clean-up: enforce deadlines, per-topic budget and daily capacity.
        cleaned: list[dict] = []
        day_used: dict[str, int] = {}
        topic_used: dict[str, int] = {}
        for b in sorted(blocks, key=lambda x: x["date"]):
            t = by_code[b["code"]]
            if t["deadline"] and b["date"] > t["deadline"]:
                continue
            minutes = min(b["minutes"], t["left"] - topic_used.get(b["code"], 0), daily - day_used.get(b["date"], 0))
            if minutes < MIN_BLOCK:
                continue
            cleaned.append({**b, "minutes": minutes})
            day_used[b["date"]] = day_used.get(b["date"], 0) + minutes
            topic_used[b["code"]] = topic_used.get(b["code"], 0) + minutes

        if state.get("issues") and source == "ai":
            warnings.append("The plan was adjusted automatically to fit your daily limit and deadlines.")

        unscheduled = []
        for t in state["topics"]:
            got = topic_used.get(t["code"], 0)
            if got == 0:
                reason = "No room before its deadline" if t["deadline"] and t["deadline"] <= state["window"][-1] else "Didn't fit in this window"
                unscheduled.append({"code": t["code"], "reason": reason})
            elif got < t["left"] * 0.6:
                warnings.append(f'"{t["title"]}" only got {got} of the {t["left"]} minutes it needs in this window.')

        days_out: dict[str, dict[str, Any]] = {}
        for b in cleaned:
            day = days_out.setdefault(b["date"], {"date": b["date"], "tip": "", "blocks": []})
            day["blocks"].append({"code": b["code"], "minutes": b["minutes"], "focus": b["focus"]})
            day["tip"] = day["tip"] or b.get("tip", "")
        return {
            "plan": {
                "source": source,
                "summary": summary or "Here's your plan.",
                "days": [days_out[d] for d in sorted(days_out)],
                "unscheduled": unscheduled,
                "warnings": warnings,
                "attempts": state["attempts"],
            }
        }

    graph = StateGraph(PlannerState)
    graph.add_node("prepare", prepare)
    graph.add_node("draft", draft)
    graph.add_node("validate", validate)
    graph.add_node("revise", revise)
    graph.add_node("finalize", finalize)
    graph.add_edge(START, "prepare")
    graph.add_edge("prepare", "draft")
    graph.add_edge("draft", "validate")
    graph.add_conditional_edges("validate", route, {"revise": "revise", "finalize": "finalize"})
    graph.add_edge("revise", "validate")
    graph.add_edge("finalize", END)
    return graph.compile()
