# Her Little Universe 🌸

A private, single-user productivity, wellness and happiness app: study planner with Pomodoro timer, sleep tracker,
goals and habits, mood journal, night reflections, a Happiness Garden that grows as she does, a Surprise Box,
achievements, a calendar with reminders, and optional AI features powered by Groq.

No login or accounts: it is a private app for one person. Keep the deployment URL private.

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2, Alembic |
| Database | PostgreSQL (Neon) |
| AI | Groq via LangChain; LangGraph for the multi-step study planner |

## Quick start

You need Python 3.11+, Node 18+ and a [Neon](https://neon.tech) project (free tier is fine).

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                    # then edit .env (see below)
alembic upgrade head                                    # creates all tables
uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs  ·  health check: http://127.0.0.1:8000/api/health

On first start the app seeds starter habits (exercise, reading, hydration, revision), a set of kind messages for the
Surprise Box and a bedtime reminder. This happens once; anything she later edits or deletes is never re-created.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                                             # http://localhost:5173
```

The dev server proxies `/api` to the backend, so the browser only ever talks to your own origin.

### 3. Add the Groq key (optional)

Put it in `backend/.env` as `GROQ_API_KEY=...` and restart the backend. The key lives only on the server.
Without it everything works except the AI features, which show a friendly "not set up" state.

## Environment variables (backend/.env)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | local SQLite file | Neon connection string. `postgres://` and `postgresql://` are both accepted. |
| `GROQ_API_KEY` | empty | Enables AI features. Never sent to the browser. |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Any Groq chat model. |
| `AI_ENABLED` | `true` | Server-wide kill switch for AI. (She can also switch AI off in Settings.) |
| `AI_TEMPERATURE` / `AI_TIMEOUT_SECONDS` / `AI_MAX_RETRIES` | `0.6` / `45` / `2` | Model tuning. |
| `APP_TIMEZONE` | `Asia/Kolkata` | Timezone used to decide what "today" is. |
| `CORS_ORIGINS` | localhost:5173 | Allowed origins if the frontend calls the API directly. |
| `LOG_LEVEL`, `ENVIRONMENT` | `INFO`, `development` | Logging / labelling. |

Frontend: `VITE_BACKEND_URL` (dev proxy target) and `VITE_API_URL` (production API base). No secrets belong in `VITE_*`.

If `DATABASE_URL` is unset the backend falls back to a local SQLite file, which is handy for a quick look, but use Neon
for real data.

## Features → where to find them

| Feature | Page | Notes |
|---|---|---|
| Dashboard | Home | Greeting, study/sleep today, tasks, goal %, habits, mood, garden, weekly overview. All live data. |
| Study planner | Study | Topics (priority, deadline, estimate), actual time, Pomodoro (survives refresh), analytics, carry-forward she controls, suggested order, AI plan. |
| Sleep | Sleep | Bedtime and wake time, auto duration, weekly/monthly charts, consistency score, custom reminders. |
| Goals & habits | Goals & Habits | Daily goals, counted habits (e.g. 8 glasses), streaks that survive an unfinished *today*, weekly/monthly reports. |
| Mood journal | Mood Journal | Emoji check-in, trends, journal with search, optional AI reflection. |
| Garden | Garden | XP only ever goes up. 25 unlockable flowers, plants, creatures and decorations. |
| Surprise Box | Surprise Box | Daily surprise, random messages, hugs, her own special messages. |
| Night reflection | Night Reflection | The four questions, saved per night, browse and search past entries. |
| Achievements | Achievements | 36 badges with progress, today/this-week, monthly summary. |
| Calendar | Calendar | Month view merging events with study deadlines and plans, upcoming list, reminders. |
| AI | Study / AI Companion | See below. |

## AI design

All AI lives in `backend/app/ai/` and is only called from `routers/ai.py`. Ordinary CRUD never touches a model.

* **Study planner (LangGraph):** `prepare → draft → validate → (revise ↺) → finalize`. The model drafts a schedule as JSON,
  deterministic code validates it (capacity per day, deadlines, per-topic budget), and failures go back to the model
  with the concrete problems (max 2 revisions). If the model never produces usable output, a deterministic priority-based
  plan is returned and labelled as such. Topics use short codes (T1, T2…) so the model can't corrupt IDs. A plan only
  changes her data when she presses **Use this plan**.
* **Study buddy, weekly summary, motivation, journal/mood reflection:** single LLM calls. Numbers in summaries come from
  the database; the model only words them. Reflections include a caring note if the text suggests she may be struggling.
* **Intelligent prioritisation** is transparent rules (priority + deadline urgency + progress), not an LLM, so it is instant and
  explainable ("Overdue by 2 days · High priority").
* Swap provider/model in `ai/client.py` or via env vars; prompts are all in `ai/prompts.py`.

## Database

16 tables with UUID primary keys, `created_at`/`updated_at`, foreign keys, indexes and CHECK constraints:
`app_settings, daily_goals, habits, habit_logs, study_topics, study_sessions, sleep_records, mood_entries,
journal_entries (journal + reflections), achievements, garden_progress, garden_items, xp_events, surprises,
calendar_events, reminders`. `xp_events` has a unique (type, source) key, which is what makes every XP award idempotent.

Migrations: `alembic upgrade head` (apply), `alembic downgrade base` (revert), `alembic revision --autogenerate -m "msg"` (new).

## Tests

```bash
cd backend && pytest                                   # 60 tests on a throwaway SQLite file
TEST_DATABASE_URL=postgresql://user@localhost/emptydb pytest   # same suite on PostgreSQL (tables are dropped/recreated!)
```

Covers streak/consistency maths, every CRUD flow, XP idempotency and the "never punish" rules, carry-forward,
sleep validation, calendar merging, reminders, dashboard aggregation, and the AI layer with a fake model
(planner happy path, revise loop, deterministic fallback, deadline enforcement, 503/502 handling).
