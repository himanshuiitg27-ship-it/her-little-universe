"""End-to-end API tests (real database, no mocks) for the critical flows."""

from datetime import timedelta

from app.services import dates

TODAY = dates.today
IST_OFFSET = "+05:30"


def iso(d):
    return d.isoformat()


# ------------------------------------------------------------------ basics


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_validation_errors_use_one_shape(client):
    r = client.post("/api/goals", json={"title": ""})
    assert r.status_code == 422
    body = r.json()["error"]
    assert body["code"] == "validation_error" and body["message"]


def test_not_found_shape(client):
    r = client.patch("/api/goals/00000000-0000-0000-0000-000000000000", json={"title": "x"})
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_settings_persist(client):
    r = client.patch("/api/settings", json={"display_name": "  Aanya ", "daily_study_goal_minutes": 180})
    assert r.status_code == 200 and r.json()["display_name"] == "Aanya"
    again = client.get("/api/settings").json()
    assert again["display_name"] == "Aanya" and again["daily_study_goal_minutes"] == 180
    assert client.patch("/api/settings", json={"daily_study_goal_minutes": 5}).status_code == 422


# ------------------------------------------------------------------ goals + garden


def test_goal_completion_awards_xp_once_and_never_removes_it(client):
    g = client.post("/api/goals", json={"title": "Read chapter 3"}).json()
    done = client.patch(f"/api/goals/{g['id']}", json={"is_completed": True}).json()
    assert done["is_completed"] is True and done["completed_at"]
    assert done["rewards"]["xp_gained"] == 10

    client.patch(f"/api/goals/{g['id']}", json={"is_completed": False})
    again = client.patch(f"/api/goals/{g['id']}", json={"is_completed": True}).json()
    assert again["rewards"] is None or again["rewards"]["xp_gained"] == 0  # no double XP

    garden = client.get("/api/garden").json()
    assert garden["total_xp"] >= 10
    # Un-ticking must never take XP away.
    client.patch(f"/api/goals/{g['id']}", json={"is_completed": False})
    assert client.get("/api/garden").json()["total_xp"] == garden["total_xp"]


def test_finishing_all_goals_gives_bonus(client):
    ids = [client.post("/api/goals", json={"title": t}).json()["id"] for t in ("a", "b")]
    client.patch(f"/api/goals/{ids[0]}", json={"is_completed": True})
    last = client.patch(f"/api/goals/{ids[1]}", json={"is_completed": True}).json()
    assert last["rewards"]["xp_gained"] == 10 + 15
    first_badges = {b["key"] for b in last["rewards"]["new_achievements"]}
    assert "perfect_day_1" in first_badges


def test_goals_are_per_day(client):
    tomorrow = TODAY() + timedelta(days=1)
    client.post("/api/goals", json={"title": "today"})
    client.post("/api/goals", json={"title": "tomorrow", "goal_date": iso(tomorrow)})
    assert [g["title"] for g in client.get("/api/goals").json()] == ["today"]
    assert [g["title"] for g in client.get(f"/api/goals?goal_date={iso(tomorrow)}").json()] == ["tomorrow"]


def test_garden_grows_and_unlocks_items(client):
    start = client.get("/api/garden").json()
    assert start["level"] == 1 and start["items"][0]["key"] == "sprout" and start["items"][0]["unlocked"]
    assert start["next_unlock"]["unlocked"] is False

    # 25 min of study = 5 xp each time; do enough sessions to cross level 2 (25 xp) and unlock the tulip (15 xp).
    leveled = False
    for _ in range(6):
        r = client.post("/api/study/sessions", json={"duration_minutes": 25, "kind": "pomodoro"}).json()
        leveled = leveled or bool(r["rewards"] and r["rewards"]["leveled_up"])
    garden = client.get("/api/garden").json()
    assert garden["total_xp"] == 30 and garden["level"] == 2 and leveled
    assert {i["key"] for i in garden["items"] if i["unlocked"]} >= {"sprout", "tulip"}
    assert garden["recent_events"][0]["label"]


# ------------------------------------------------------------------ habits


def test_habit_streak_and_progress(client):
    habit = client.post("/api/habits", json={"name": "Water", "target_count": 8, "unit": "glasses"}).json()
    hid = habit["id"]
    today = TODAY()
    for back in (2, 1):
        client.put(f"/api/habits/{hid}/logs/{iso(today - timedelta(days=back))}", json={"count": 8})

    partial = client.put(f"/api/habits/{hid}/logs/{iso(today)}", json={"count": 3}).json()
    assert partial["habit"]["is_done"] is False and partial["rewards"] is None
    # Today isn't finished yet, but the 2-day streak stays alive.
    assert partial["habit"]["current_streak"] == 2

    full = client.put(f"/api/habits/{hid}/logs/{iso(today)}", json={"count": 8}).json()
    assert full["habit"]["is_done"] and full["habit"]["current_streak"] == 3
    assert full["rewards"]["xp_gained"] == 8
    assert full["habit"]["last_7_days"][-3:] == [True, True, True]

    listed = client.get("/api/habits").json()
    assert listed[0]["count"] == 8


def test_habit_report_only_counts_elapsed_days(client):
    hid = client.post("/api/habits", json={"name": "Stretch"}).json()["id"]
    client.put(f"/api/habits/{hid}/logs/{iso(TODAY())}", json={"count": 1})
    report = client.get("/api/habits/report?period=week").json()
    row = report["habits"][0]
    assert row["days_done"] == 1
    assert row["days_in_period"] == TODAY().weekday() + 1  # Mon..today, never the future
    assert report["overall_pct"] == int(100 / (TODAY().weekday() + 1))


def test_deleting_a_habit_removes_its_logs(client):
    hid = client.post("/api/habits", json={"name": "Temp"}).json()["id"]
    client.put(f"/api/habits/{hid}/logs/{iso(TODAY())}", json={"count": 1})
    assert client.delete(f"/api/habits/{hid}").status_code == 204
    assert client.get("/api/habits").json() == []


# ------------------------------------------------------------------ study


def test_topic_lifecycle_and_actual_time(client):
    topic = client.post(
        "/api/study/topics",
        json={"title": "Organic chemistry", "subject": "Chemistry", "priority": "high", "estimated_minutes": 120,
              "deadline": iso(TODAY() + timedelta(days=3))},
    ).json()
    assert topic["actual_minutes"] == 0 and topic["is_overdue"] is False

    client.post("/api/study/sessions", json={"topic_id": topic["id"], "duration_minutes": 40, "kind": "pomodoro"})
    client.post("/api/study/sessions", json={"topic_id": topic["id"], "duration_minutes": 20})
    fetched = client.get("/api/study/topics").json()[0]
    assert fetched["actual_minutes"] == 60

    edited = client.patch(f"/api/study/topics/{topic['id']}", json={"title": "Orgo reactions", "priority": "medium"}).json()
    assert edited["title"] == "Orgo reactions" and edited["priority"] == "medium"

    done = client.patch(f"/api/study/topics/{topic['id']}", json={"is_completed": True}).json()
    assert done["is_completed"] and done["completed_at"] and done["rewards"]["xp_gained"] == 15
    assert client.get("/api/study/topics?status=pending").json() == []
    assert len(client.get("/api/study/topics?status=completed").json()) == 1

    assert client.delete(f"/api/study/topics/{topic['id']}").status_code == 204
    assert client.get("/api/study/topics").json() == []


def test_session_for_unknown_topic_is_404(client):
    r = client.post("/api/study/sessions", json={"topic_id": "00000000-0000-0000-0000-000000000000", "duration_minutes": 10})
    assert r.status_code == 404


def test_deleting_topic_keeps_its_study_time(client):
    topic = client.post("/api/study/topics", json={"title": "Gone"}).json()
    client.post("/api/study/sessions", json={"topic_id": topic["id"], "duration_minutes": 30})
    client.delete(f"/api/study/topics/{topic['id']}")
    assert client.get("/api/study/analytics?period=day").json()["total_minutes"] == 30


def test_carry_forward_is_user_controlled(client):
    yesterday = TODAY() - timedelta(days=1)
    t1 = client.post("/api/study/topics", json={"title": "Unfinished A", "planned_date": iso(yesterday)}).json()
    t2 = client.post("/api/study/topics", json={"title": "Unfinished B", "planned_date": iso(yesterday)}).json()
    client.post("/api/study/topics", json={"title": "Future", "planned_date": iso(TODAY() + timedelta(days=2))})
    finished = client.post("/api/study/topics", json={"title": "Done", "planned_date": iso(yesterday)}).json()
    client.patch(f"/api/study/topics/{finished['id']}", json={"is_completed": True})

    candidates = client.get("/api/study/carry-forward").json()
    assert {c["title"] for c in candidates} == {"Unfinished A", "Unfinished B"}
    # Nothing moved on its own.
    assert client.get("/api/study/topics").json()  # still planned yesterday
    assert {t["planned_date"] for t in client.get("/api/study/topics").json() if t["title"].startswith("Unfinished")} == {iso(yesterday)}

    moved = client.post("/api/study/carry-forward", json={"topic_ids": [t1["id"]]}).json()
    assert moved == {"moved": 1, "target_date": iso(TODAY())}
    remaining = client.get("/api/study/carry-forward").json()
    assert [c["id"] for c in remaining] == [t2["id"]]


def test_prioritisation_puts_urgent_high_priority_first(client):
    today = TODAY()
    client.post("/api/study/topics", json={"title": "Someday", "priority": "low"})
    client.post("/api/study/topics", json={"title": "Next month", "priority": "high", "deadline": iso(today + timedelta(days=30))})
    client.post("/api/study/topics", json={"title": "Tomorrow", "priority": "medium", "deadline": iso(today + timedelta(days=1))})
    client.post("/api/study/topics", json={"title": "Overdue", "priority": "low", "deadline": iso(today - timedelta(days=2))})
    ranked = client.get("/api/study/prioritized").json()
    assert [r["topic"]["title"] for r in ranked][:2] == ["Overdue", "Tomorrow"]
    assert any("Overdue" in reason for reason in ranked[0]["reasons"])


def test_study_analytics_week_and_subjects(client):
    math = client.post("/api/study/topics", json={"title": "Calculus", "subject": "Math"}).json()
    client.post("/api/study/sessions", json={"topic_id": math["id"], "duration_minutes": 50})
    client.post("/api/study/sessions", json={"duration_minutes": 25, "kind": "pomodoro"})
    week = client.get("/api/study/analytics?period=week").json()
    assert week["total_minutes"] == 75 and len(week["days"]) == 7 and week["active_days"] == 1
    assert {s["subject"]: s["minutes"] for s in week["by_subject"]} == {"Math": 50, "General": 25}
    month = client.get("/api/study/analytics?period=month").json()
    assert month["total_minutes"] == 75 and month["best_day"] == iso(TODAY())


# ------------------------------------------------------------------ sleep


def sleep_payload(wake_day, bed="23:00", wake="07:00", **extra):
    bed_day = wake_day - timedelta(days=1)
    return {
        "bedtime": f"{iso(bed_day)}T{bed}:00{IST_OFFSET}",
        "wake_time": f"{iso(wake_day)}T{wake}:00{IST_OFFSET}",
        **extra,
    }


def test_sleep_duration_is_calculated_overnight(client):
    r = client.post("/api/sleep", json=sleep_payload(TODAY(), "23:15", "07:45", quality=4))
    assert r.status_code == 201
    body = r.json()
    assert body["duration_minutes"] == 510 and body["sleep_date"] == iso(TODAY())
    assert body["rewards"]["xp_gained"] == 5


def test_sleep_validation_and_duplicates(client):
    bad = {"bedtime": f"{iso(TODAY())}T07:00:00{IST_OFFSET}", "wake_time": f"{iso(TODAY())}T06:00:00{IST_OFFSET}"}
    assert client.post("/api/sleep", json=bad).status_code == 422
    naive = {"bedtime": "2026-11-14T23:00:00", "wake_time": "2026-11-15T07:00:00"}
    assert client.post("/api/sleep", json=naive).status_code == 422
    assert client.post("/api/sleep", json=sleep_payload(TODAY())).status_code == 201
    dup = client.post("/api/sleep", json=sleep_payload(TODAY(), "22:00"))
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "conflict"


def test_sleep_edit_recalculates(client):
    rec = client.post("/api/sleep", json=sleep_payload(TODAY())).json()
    patched = client.patch(
        f"/api/sleep/{rec['id']}", json={"wake_time": f"{iso(TODAY())}T08:00:00{IST_OFFSET}"}
    ).json()
    assert patched["duration_minutes"] == 540


def test_sleep_analytics_and_consistency(client):
    for back, (bed, wake) in enumerate([("23:00", "07:00"), ("23:00", "07:00"), ("23:10", "07:05"), ("22:55", "06:55")]):
        d = TODAY() - timedelta(days=back)
        if d < dates.week_bounds(TODAY())[0]:
            continue
        client.post("/api/sleep", json=sleep_payload(d, bed, wake))
    data = client.get("/api/sleep/analytics?period=week").json()
    assert len(data["days"]) == 7 and data["goal_minutes"] == 480
    if data["records_count"] >= 3:
        assert data["consistency_score"] >= 85 and data["average_bedtime"]
    month = client.get("/api/sleep/analytics?period=month").json()
    assert month["records_count"] >= 1 and month["average_minutes"]


# ------------------------------------------------------------------ mood, journal, reflections


def test_mood_upsert_trends_and_validation(client):
    options = client.get("/api/mood/options").json()
    assert {"joyful", "sad"} <= {o["key"] for o in options}
    assert client.put("/api/mood", json={"mood": "nonsense"}).status_code == 422

    first = client.put("/api/mood", json={"mood": "calm", "note": "quiet morning"}).json()
    assert first["score"] == 4 and first["emoji"] and first["rewards"]["xp_gained"] == 5
    second = client.put("/api/mood", json={"mood": "joyful"}).json()
    assert second["id"] == first["id"] and second["score"] == 5 and second["rewards"] is None  # one entry/day, XP once

    trend = client.get("/api/mood/trends?days=7").json()
    assert trend["entries_count"] == 1 and trend["average_score"] == 5 and trend["most_common"] == "joyful"
    assert client.get("/api/dashboard").json()["mood_today"]["mood"] == "joyful"


def test_journal_crud_and_search(client):
    a = client.post("/api/journal", json={"title": "Exam day", "content": "Felt nervous but proud"}).json()
    client.post("/api/journal", json={"content": "Long walk by the river"})
    assert a["rewards"]["xp_gained"] == 5
    assert len(client.get("/api/journal").json()) == 2
    hits = client.get("/api/journal?q=river").json()
    assert len(hits) == 1 and hits[0]["content"].startswith("Long walk")
    edited = client.patch(f"/api/journal/{a['id']}", json={"content": "Felt nervous, then proud"}).json()
    assert edited["content"] == "Felt nervous, then proud"
    assert client.delete(f"/api/journal/{a['id']}").status_code == 204
    assert len(client.get("/api/journal").json()) == 1


def test_night_reflection_save_browse_and_update(client):
    day = iso(TODAY())
    assert client.get(f"/api/reflections/{day}").status_code == 404
    assert client.put(f"/api/reflections/{day}", json={}).status_code == 422

    saved = client.put(
        f"/api/reflections/{day}",
        json={"happy_moment": "Tea with a friend", "accomplishment": "Finished my notes", "improvement": "", "gratitude": "My family"},
    ).json()
    assert saved["kind"] == "reflection" and saved["improvement"] is None and saved["rewards"]["xp_gained"] == 10

    updated = client.put(f"/api/reflections/{day}", json={"happy_moment": "Tea and a long chat"}).json()
    assert updated["id"] == saved["id"] and updated["accomplishment"] is None and updated["rewards"] is None
    assert client.get(f"/api/reflections/{day}").json()["happy_moment"] == "Tea and a long chat"

    listed = client.get("/api/reflections").json()
    assert len(listed) == 1
    # Free journal entries and reflections stay separate.
    assert client.get("/api/journal").json() == []
    assert client.get("/api/dashboard").json()["reflection_done_today"] is True
    assert client.delete(f"/api/reflections/{saved['id']}").status_code == 204


# ------------------------------------------------------------------ achievements


def test_achievements_unlock_with_progress(client):
    before = client.get("/api/achievements").json()
    assert before["unlocked_count"] == 0 and before["total_count"] > 20
    focus = next(a for a in before["achievements"] if a["key"] == "first_focus")
    assert focus["progress_pct"] == 0 and not focus["unlocked"]

    r = client.post("/api/study/sessions", json={"duration_minutes": 25, "kind": "pomodoro"}).json()
    assert "first_focus" in {b["key"] for b in r["rewards"]["new_achievements"]}

    after = client.get("/api/achievements").json()
    assert after["unlocked_count"] >= 1
    assert "first_focus" in {a["key"] for a in after["today"]}
    scholar = next(a for a in after["achievements"] if a["key"] == "scholar_5h")
    assert scholar["value"] == 25 and 0 < scholar["progress_pct"] < 100


def test_monthly_summary(client):
    client.post("/api/study/sessions", json={"duration_minutes": 90})
    g = client.post("/api/goals", json={"title": "x"}).json()
    client.patch(f"/api/goals/{g['id']}", json={"is_completed": True})
    month = dates.today().strftime("%Y-%m")
    s = client.get(f"/api/achievements/summary?month={month}").json()
    assert s["study_minutes"] == 90 and s["goals_completed"] == 1 and s["xp_earned"] > 0
    assert client.get("/api/achievements/summary?month=bad").status_code == 422


# ------------------------------------------------------------------ surprises


def test_surprises_daily_is_stable_and_custom_messages_work(seeded_client):
    c = seeded_client
    first = c.get("/api/surprises/daily").json()
    assert c.get("/api/surprises/daily").json()["id"] == first["id"]

    mine = c.post("/api/surprises", json={"kind": "special", "content": "I'm so proud of you 💗"}).json()
    assert mine["is_custom"]
    assert c.patch(f"/api/surprises/{mine['id']}", json={"content": "Proud of you, always"}).json()["content"] == "Proud of you, always"

    hug = c.get("/api/surprises/random?kind=hug").json()
    assert hug["kind"] == "hug" and hug["times_shown"] == 1

    builtin = next(s for s in c.get("/api/surprises").json() if not s["is_custom"])
    assert c.delete(f"/api/surprises/{builtin['id']}").status_code == 422
    assert c.patch(f"/api/surprises/{builtin['id']}", json={"content": "hacked"}).status_code == 422
    assert c.patch(f"/api/surprises/{builtin['id']}", json={"is_active": False}).json()["is_active"] is False
    assert c.delete(f"/api/surprises/{mine['id']}").status_code == 204


def test_surprises_empty_state(client):
    r = client.get("/api/surprises/daily")
    assert r.status_code == 404 and "message" in r.json()["error"]


# ------------------------------------------------------------------ calendar & reminders


def test_calendar_merges_events_and_study_deadlines(client):
    today = TODAY()
    client.post("/api/calendar/events", json={"title": "Physics exam", "event_type": "exam", "event_date": iso(today + timedelta(days=5)), "start_time": "10:00:00"})
    client.post("/api/study/topics", json={"title": "Optics", "deadline": iso(today + timedelta(days=2)), "planned_date": iso(today + timedelta(days=1))})
    month = client.get(f"/api/calendar/month?year={today.year}&month={today.month}").json()
    titles = {i["title"] for i in month["items"]}
    # Items outside this month (if the window crosses a month end) are legitimately absent.
    expected = {"Physics exam", "Due: Optics", "Study: Optics"}
    in_month = {t for t, d in [("Physics exam", today + timedelta(days=5)), ("Due: Optics", today + timedelta(days=2)), ("Study: Optics", today + timedelta(days=1))] if d.month == today.month}
    assert in_month <= titles <= expected

    upcoming = client.get("/api/calendar/upcoming?days=14").json()
    assert [i["title"] for i in upcoming] == ["Study: Optics", "Due: Optics", "Physics exam"]
    assert {i["editable"] for i in upcoming if i["source"] != "event"} == {False}


def test_calendar_event_validation_and_crud(client):
    d = iso(TODAY())
    bad = client.post("/api/calendar/events", json={"title": "x", "event_date": d, "start_time": "10:00:00", "end_time": "09:00:00"})
    assert bad.status_code == 422
    ev = client.post("/api/calendar/events", json={"title": "Birthday", "event_type": "personal", "event_date": d}).json()
    assert client.patch(f"/api/calendar/events/{ev['id']}", json={"is_completed": True}).json()["is_completed"]
    assert client.delete(f"/api/calendar/events/{ev['id']}").status_code == 204
    assert client.get("/api/calendar/month?year=2026&month=13").status_code == 422


def test_reminders_crud_and_validation(client):
    assert client.post("/api/reminders", json={"title": "x", "remind_time": "22:00:00", "days_of_week": []}).status_code == 422
    assert client.post("/api/reminders", json={"title": "x", "remind_time": "22:00:00", "days_of_week": [9]}).status_code == 422
    r = client.post("/api/reminders", json={"title": "Wind down", "kind": "sleep", "remind_time": "22:30:00", "days_of_week": [4, 0, 0, 2]}).json()
    assert r["days_of_week"] == [0, 2, 4]
    off = client.patch(f"/api/reminders/{r['id']}", json={"is_enabled": False}).json()
    assert off["is_enabled"] is False
    assert client.get("/api/reminders?enabled_only=true").json() == []
    assert len(client.get("/api/reminders").json()) == 1
    assert client.delete(f"/api/reminders/{r['id']}").status_code == 204


# ------------------------------------------------------------------ dashboard (everything is data-driven)


def test_dashboard_reflects_real_data(seeded_client):
    c = seeded_client
    empty = c.get("/api/dashboard").json()
    assert empty["goals"]["total"] == 0 and empty["study"]["today_minutes"] == 0 and empty["habits"]["total"] == 4
    assert empty["message"] and empty["message"]["kind"] == "motivation"
    assert len(empty["week"]) == 7 and sum(1 for d in empty["week"] if d["is_today"]) == 1

    c.patch("/api/settings", json={"display_name": "Mira", "daily_study_goal_minutes": 100})
    g1 = c.post("/api/goals", json={"title": "Revise"}).json()
    c.post("/api/goals", json={"title": "Walk"})
    c.patch(f"/api/goals/{g1['id']}", json={"is_completed": True})
    c.post("/api/study/sessions", json={"duration_minutes": 50})
    habit = c.get("/api/habits").json()[0]
    c.put(f"/api/habits/{habit['id']}/logs/{iso(TODAY())}", json={"count": habit["target_count"]})
    c.post("/api/study/topics", json={"title": "Due now", "deadline": iso(TODAY())})
    c.post("/api/sleep", json=sleep_payload(TODAY()))

    d = c.get("/api/dashboard").json()
    assert d["display_name"] == "Mira"
    assert d["study"] == {"today_minutes": 50, "goal_minutes": 100, "goal_pct": 50, "sessions_today": 1}
    assert d["goals"]["completed"] == 1 and d["goals"]["total"] == 2 and d["goals"]["pct"] == 50
    assert d["habits"]["completed"] == 1 and d["habits"]["pct"] == 25
    assert d["tasks"]["pending"] == 1 and d["tasks"]["items"][0]["title"] == "Due now"
    assert d["sleep"]["last_duration_minutes"] == 480 and d["sleep"]["goal_pct"] == 100
    assert d["garden"]["total_xp"] > 0 and d["garden"]["xp_today"] == d["garden"]["total_xp"]
    today_col = next(day for day in d["week"] if day["is_today"])
    assert today_col["study_minutes"] == 50 and today_col["goals_completed"] == 1 and today_col["habits_completed"] == 1
    assert d["ai_available"] is False


def test_seeding_runs_only_once(seeded_client):
    c = seeded_client
    for h in c.get("/api/habits").json():
        c.delete(f"/api/habits/{h['id']}")
    from app.database import SessionLocal
    from app.services.seed import seed_defaults

    with SessionLocal() as db:
        assert seed_defaults(db) is False
    assert c.get("/api/habits").json() == []
