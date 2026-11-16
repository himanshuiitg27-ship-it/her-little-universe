"""AI features, tested with a fake chat model (no network, no API key)."""

import json
from datetime import timedelta

from app.services import dates


def iso(d):
    return d.isoformat()


def make_topics(client):
    today = dates.today()
    a = client.post("/api/study/topics", json={"title": "Thermodynamics", "subject": "Physics", "priority": "high", "estimated_minutes": 120, "deadline": iso(today + timedelta(days=3))}).json()
    b = client.post("/api/study/topics", json={"title": "Poetry analysis", "subject": "English", "priority": "low", "estimated_minutes": 60}).json()
    return a, b


def plan_json(days):
    return json.dumps({"summary": "A calm, balanced week.", "days": days})


def day(offset, *blocks, tip=""):
    return {"date": iso(dates.today() + timedelta(days=offset)), "tip": tip, "blocks": [{"topic": c, "minutes": m, "focus": "Practice"} for c, m in blocks]}


# ------------------------------------------------------------------ availability


def test_status_when_not_configured(client):
    s = client.get("/api/ai/status").json()
    assert s["configured"] is False and s["enabled"] is False and "GROQ_API_KEY" in s["reason"]


def test_ai_endpoints_return_503_without_key_and_never_leak_secrets(client):
    r = client.post("/api/ai/weekly-summary")
    assert r.status_code == 503 and r.json()["error"]["code"] == "ai_unavailable"
    assert "gsk_" not in r.text


def test_status_when_configured_and_when_switched_off(client, ai_on):
    assert client.get("/api/ai/status").json()["enabled"] is True
    client.patch("/api/settings", json={"ai_enabled": False})
    s = client.get("/api/ai/status").json()
    assert s["enabled"] is False and "settings" in s["reason"]
    assert client.post("/api/ai/motivation", json={}).status_code == 503


# ------------------------------------------------------------------ study planner graph


def test_planner_happy_path(client, fake_llm):
    a, b = make_topics(client)
    fake_llm([plan_json([day(0, ("T1", 60)), day(1, ("T1", 60), ("T2", 30)), day(2, ("T2", 30))])])
    r = client.post("/api/ai/study-plan", json={"days": 5, "daily_minutes": 120})
    assert r.status_code == 200
    plan = r.json()
    assert plan["source"] == "ai" and plan["attempts"] == 0 and plan["warnings"] == []
    assert [d["total_minutes"] for d in plan["days"]] == [60, 90, 30]
    first = plan["days"][0]["blocks"][0]
    assert first["topic_id"] == a["id"] and first["title"] == "Thermodynamics"
    assert plan["unscheduled"] == []


def test_planner_revises_when_the_first_draft_breaks_the_rules(client, fake_llm):
    make_topics(client)
    too_much = plan_json([day(0, ("T1", 120), ("T2", 60))])  # 180 min > 120 min capacity
    fixed = plan_json([day(0, ("T1", 90)), day(1, ("T1", 30), ("T2", 60))])
    model = fake_llm([too_much, fixed])
    plan = client.post("/api/ai/study-plan", json={"days": 3, "daily_minutes": 120}).json()
    assert plan["source"] == "ai" and plan["attempts"] == 1
    assert max(d["total_minutes"] for d in plan["days"]) <= 120
    assert model is not None


def test_planner_falls_back_when_model_never_returns_json(client, fake_llm):
    make_topics(client)
    fake_llm(["Sorry, I can't do that.", "Still not JSON", "Nope"])
    plan = client.post("/api/ai/study-plan", json={"days": 4, "daily_minutes": 90}).json()
    assert plan["source"] == "fallback" and plan["attempts"] == 2
    assert any("couldn't produce" in w for w in plan["warnings"])
    assert plan["days"] and max(d["total_minutes"] for d in plan["days"]) <= 90
    # Most urgent topic (the one with a deadline) is scheduled first.
    assert plan["days"][0]["blocks"][0]["title"] == "Thermodynamics"


def test_planner_final_cleanup_enforces_deadlines_even_if_model_keeps_failing(client, fake_llm):
    a, _ = make_topics(client)
    # Deadline is +3 days; the model keeps scheduling on day +5 (after the deadline) and invents a code.
    bad = plan_json([day(5, ("T1", 60)), day(1, ("T9", 30)), day(1, ("T1", 45))])
    fake_llm([bad, bad, bad])
    plan = client.post("/api/ai/study-plan", json={"days": 7, "daily_minutes": 120}).json()
    dates_used = [d["date"] for d in plan["days"]]
    assert iso(dates.today() + timedelta(days=5)) not in dates_used
    assert all(b["topic_id"] == a["id"] for d in plan["days"] for b in d["blocks"])
    assert plan["warnings"]


def test_planner_rejects_empty_and_past_requests(client, fake_llm):
    fake_llm(["{}"])
    assert client.post("/api/ai/study-plan", json={}).status_code == 422  # no topics yet
    make_topics(client)
    past = iso(dates.today() - timedelta(days=1))
    assert client.post("/api/ai/study-plan", json={"start_date": past}).status_code == 422


def test_applying_a_plan_sets_planned_dates_only_when_asked(client):
    a, b = make_topics(client)
    d1, d2 = dates.today() + timedelta(days=1), dates.today() + timedelta(days=2)
    r = client.post(
        "/api/ai/study-plan/apply",
        json={"assignments": [{"topic_id": a["id"], "date": iso(d2)}, {"topic_id": a["id"], "date": iso(d1)}, {"topic_id": b["id"], "date": iso(d2)}]},
    )
    assert r.json() == {"updated": 2}
    planned = {t["title"]: t["planned_date"] for t in client.get("/api/study/topics").json()}
    assert planned == {"Thermodynamics": iso(d1), "Poetry analysis": iso(d2)}  # earliest date wins


# ------------------------------------------------------------------ assistant, summary, motivation, reflection


def test_study_assistant_replies(client, fake_llm):
    fake_llm(["Think of entropy as how spread-out energy is. 🌿"])
    a, _ = make_topics(client)
    r = client.post("/api/ai/assistant", json={"messages": [{"role": "user", "content": "Explain entropy simply"}], "topic_id": a["id"]})
    assert r.status_code == 200 and "entropy" in r.json()["reply"].lower()


def test_study_assistant_validation(client, fake_llm):
    fake_llm(["hi"])
    assert client.post("/api/ai/assistant", json={"messages": []}).status_code == 422
    last_assistant = {"messages": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]}
    assert client.post("/api/ai/assistant", json=last_assistant).status_code == 422


def test_weekly_summary_uses_real_stats(client, fake_llm):
    client.post("/api/study/sessions", json={"duration_minutes": 90})
    g = client.post("/api/goals", json={"title": "x"}).json()
    client.patch(f"/api/goals/{g['id']}", json={"is_completed": True})
    fake_llm(["What a gentle, steady week. 🌸"])
    r = client.post("/api/ai/weekly-summary").json()
    assert r["summary"].startswith("What a gentle")
    assert r["stats"]["study_hours"] == 1.5 and r["stats"]["goals_completed"] == 1


def test_motivation(client, fake_llm):
    fake_llm(["One small page today is a lovely start."])
    assert client.post("/api/ai/motivation", json={"focus": "exam week"}).json()["message"].startswith("One small page")


def test_reflection_is_saved_on_the_entry(client, fake_llm):
    entry = client.put("/api/mood", json={"mood": "tired", "note": "Long day at the library"}).json()
    fake_llm(["Long days are heavy. You still showed up. 💗"])
    r = client.post("/api/ai/reflect", json={"source": "mood", "id": entry["id"]})
    assert r.status_code == 200
    saved = client.get(f"/api/mood?start={entry['entry_date']}&end={entry['entry_date']}").json()[0]
    assert saved["ai_reflection"] == r.json()["reflection"]
    # Editing the note makes the old reflection stale, so it is cleared.
    client.put("/api/mood", json={"mood": "tired", "note": "Changed my mind"})
    assert client.get(f"/api/mood?start={entry['entry_date']}&end={entry['entry_date']}").json()[0]["ai_reflection"] is None


def test_reflection_on_journal_and_night_reflection(client, fake_llm):
    j = client.post("/api/journal", json={"content": "Today felt peaceful."}).json()
    n = client.put(f"/api/reflections/{iso(dates.today())}", json={"gratitude": "Warm tea"}).json()
    fake_llm(["Peaceful days matter."])
    assert client.post("/api/ai/reflect", json={"source": "journal", "id": j["id"]}).status_code == 200
    assert client.post("/api/ai/reflect", json={"source": "reflection", "id": n["id"]}).status_code == 200
    # A journal id cannot be read as a night reflection.
    assert client.post("/api/ai/reflect", json={"source": "reflection", "id": j["id"]}).status_code == 404


def test_reflection_adds_a_caring_note_for_worrying_text(client, fake_llm):
    j = client.post("/api/journal", json={"content": "I feel like I want to die and nothing helps"}).json()
    fake_llm(["I'm so sorry it hurts this much."])
    reply = client.post("/api/ai/reflect", json={"source": "journal", "id": j["id"]}).json()["reflection"]
    assert "reach out to someone you trust" in reply


def test_provider_failure_becomes_a_friendly_502(client, ai_on, monkeypatch):
    from app.ai import client as ai_client

    class Boom:
        def invoke(self, *_a, **_k):
            raise RuntimeError("connection reset")

    monkeypatch.setattr(ai_client, "get_llm", lambda temperature=None: Boom())
    r = client.post("/api/ai/motivation", json={})
    assert r.status_code == 502 and r.json()["error"]["code"] == "ai_provider_error"
    assert "connection reset" not in r.text
