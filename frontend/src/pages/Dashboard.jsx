import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BookOpen, CalendarClock, Check, Flower2, Moon, Sparkles, Target } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import { useSettings } from '../context/SettingsContext'
import { AsyncView } from '../components/ui/States'
import { Chip, ProgressBar, ProgressRing } from '../components/ui/Form'
import { Section, Stat } from '../components/ui/PageHeader'
import Mascot from '../components/ui/Mascot'
import GoalItem from '../components/habits/GoalItem'
import HabitRow from '../components/habits/HabitRow'
import AddGoalForm from '../components/habits/AddGoalForm'
import MoodPicker from '../components/MoodPicker'
import { COLORS, tickProps, tooltipStyle } from '../utils/chart'
import { fmtDate, fmtMinutes, relativeDay, toISODate } from '../utils/date'

const GREETING = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Hello, night owl' }

function Hero({ d, reload, ai }) {
  const { update } = useSettings()
  const [name, setName] = useState('')
  const [aiMessage, setAiMessage] = useState(null)
  const [saveName, saving] = useAction(async () => {
    await update({ display_name: name })
    await reload()
  })
  const [askAi, asking] = useAction(async () => {
    const r = await api.post('/ai/motivation', {})
    setAiMessage(r.message)
  })
  const nightTime = d.part_of_day === 'night' || d.part_of_day === 'evening'

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-blush-100 via-lavender-100 to-sage-100 p-6 shadow-soft md:p-8">
      <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-white/30 blur-2xl" aria-hidden />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <Mascot size={92} mood={d.part_of_day === 'night' ? 'sleepy' : 'happy'} />
        <div className="min-w-0 flex-1">
          <p className="font-script text-2xl text-blush-600">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-3xl font-semibold md:text-4xl">
            {GREETING[d.part_of_day]}
            {d.display_name ? `, ${d.display_name}` : ''} <span aria-hidden>🌸</span>
          </h1>
          {!d.display_name && (
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveName() }} className="mt-3 flex max-w-sm gap-2">
              <input className="input !bg-white/70" placeholder="What should I call you?" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Your name" />
              <button className="btn-primary shrink-0" disabled={saving || !name.trim()}>Save</button>
            </form>
          )}
          <AnimatePresence mode="wait">
            <motion.p key={aiMessage || d.message?.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 max-w-xl text-base font-semibold text-ink-2">
              {aiMessage ? `✨ ${aiMessage}` : d.message ? `${d.message.emoji || '💗'} ${d.message.content}` : 'Add some messages in your Surprise Box and they will show up here. 💗'}
            </motion.p>
          </AnimatePresence>
          {ai && (
            <button className="btn-ghost mt-2 !px-2 !py-1.5 text-xs" onClick={() => askAi()} disabled={asking}>
              <Sparkles size={14} /> {asking ? 'Thinking of something sweet…' : 'Write me a personal message'}
            </button>
          )}
        </div>
      </div>
      {nightTime && !d.reflection_done_today && (
        <Link to="/reflection" className="relative mt-5 flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 text-sm font-bold text-ink-2 backdrop-blur transition hover:bg-white/80 dark:bg-black/20">
          <span>🌙 Ready for tonight's reflection?</span>
          <ArrowRight size={16} />
        </Link>
      )}
    </motion.section>
  )
}

function TodayMood({ d, reload }) {
  const [pick, busy] = useAction(async (mood) => {
    await api.put('/mood', { mood })
    await reload()
  }, { success: 'Mood saved 💗' })
  return (
    <Section title="How are you feeling?" icon={<span aria-hidden>💭</span>} action={<Link to="/mood" className="text-xs font-bold text-lavender-500 hover:underline">Journal</Link>}>
      {d.mood_today ? (
        <div className="flex items-center gap-4">
          <span className="text-5xl">{d.mood_today.emoji}</span>
          <div>
            <p className="font-display text-lg font-semibold">Feeling {d.mood_today.label?.toLowerCase()}</p>
            <p className="text-sm text-ink-2">Thank you for checking in with yourself.</p>
          </div>
        </div>
      ) : (
        <MoodPicker compact onPick={pick} disabled={busy} />
      )}
    </Section>
  )
}

export default function Dashboard() {
  const q = useQuery(() => api.get('/dashboard'), [])
  const [toggleGoal, busyGoal] = useAction((g) => api.patch(`/goals/${g.id}`, { is_completed: !g.is_completed }).then(() => q.reload()))
  const [setHabit, busyHabit] = useAction((h, count) => api.put(`/habits/${h.id}/logs/${toDay()}`, { count: Math.max(0, count) }).then(() => q.reload()))
  const [finishTopic, busyTopic] = useAction((t) => api.patch(`/study/topics/${t.id}`, { is_completed: true }).then(() => q.reload()))
  const toDay = () => toISODate()

  return (
    <AsyncView query={q}>
      {(d) => (
        <div className="space-y-5">
          <Hero d={d} reload={q.reload} ai={d.ai_available} />

          {d.carry_forward_count > 0 && (
            <Link to="/study" className="card flex items-center justify-between !p-4 hover:shadow-lift">
              <span className="text-sm font-bold text-ink-2">
                📌 {d.carry_forward_count} unfinished {d.carry_forward_count === 1 ? 'topic' : 'topics'} from earlier days. Move them to today if you'd like.
              </span>
              <ArrowRight size={16} className="text-ink-3" />
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat tone="lavender" icon={<BookOpen size={22} />} label="Studied today" value={fmtMinutes(d.study.today_minutes)} sub={`Goal ${fmtMinutes(d.study.goal_minutes)} · ${d.study.goal_pct}%`} />
            <Stat tone="blush" icon={<Moon size={22} />} label="Last sleep" value={d.sleep.last_duration_minutes ? fmtMinutes(d.sleep.last_duration_minutes) : 'Not logged'} sub={d.sleep.goal_pct !== null ? `${d.sleep.goal_pct}% of your goal` : 'Log last night in Sleep'} />
            <Stat tone="sage" icon={<Check size={22} />} label="Tasks" value={`${d.tasks.completed_today} done`} sub={`${d.tasks.pending} pending`} />
            <Stat tone="cream" icon={<Target size={22} />} label="Daily goals" value={d.goals.total ? `${d.goals.pct}%` : '–'} sub={d.goals.total ? `${d.goals.completed} of ${d.goals.total} done` : 'No goals yet'} />
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <div className="space-y-5 lg:col-span-3">
              <Section title="Today's goals" icon={<Target size={18} className="text-blush-500" />} action={d.goals.total > 0 && <Chip tone="sage">{d.goals.completed}/{d.goals.total}</Chip>}>
                {d.goals.total > 0 && <ProgressBar className="mb-3" value={d.goals.pct} tone="sage" label="Goal completion" />}
                <ul className="mb-3 space-y-0.5">
                  <AnimatePresence initial={false}>
                    {d.goals.items.map((g) => (
                      <GoalItem key={g.id} goal={{ ...g }} onToggle={toggleGoal} disabled={busyGoal} />
                    ))}
                  </AnimatePresence>
                </ul>
                {d.goals.total === 0 && <p className="mb-3 text-sm text-ink-2">A fresh page. What would feel good to finish today?</p>}
                <AddGoalForm onAdded={q.reload} />
              </Section>

              <Section title="Habits" icon={<span aria-hidden>🌱</span>} action={<Link to="/habits" className="text-xs font-bold text-lavender-500 hover:underline">All habits</Link>}>
                {d.habits.total === 0 ? (
                  <p className="text-sm text-ink-2">No habits yet. <Link className="font-bold text-lavender-500" to="/habits">Create your first one</Link>.</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-ink-2">{d.habits.completed} of {d.habits.total} complete today</p>
                    <ul className="space-y-2.5">
                      {d.habits.items.map((h) => (
                        <HabitRow key={h.id} habit={h} busy={busyHabit} onSetCount={setHabit} />
                      ))}
                    </ul>
                  </>
                )}
              </Section>

              <Section title="This week" icon={<span aria-hidden>📈</span>}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.week.map((w) => ({ day: w.weekday, hours: +(w.study_minutes / 60).toFixed(2), minutes: w.study_minutes, today: w.is_today }))} margin={{ left: -20, right: 4, top: 8 }}>
                      <CartesianGrid vertical={false} stroke={COLORS.grid} />
                      <XAxis dataKey="day" tick={tickProps} axisLine={false} tickLine={false} />
                      <YAxis tick={tickProps} axisLine={false} tickLine={false} allowDecimals={false} unit="h" />
                      <Tooltip {...tooltipStyle} formatter={(v, _n, p) => [fmtMinutes(p.payload.minutes), 'Studied']} />
                      <Bar dataKey="hours" radius={[10, 10, 4, 4]} fill={COLORS.lavender} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold">
                  {d.week.map((w) => (
                    <div key={w.date} className={`rounded-xl p-1.5 ${w.is_today ? 'bg-blush-100 text-blush-600' : 'bg-soft text-ink-2'} ${w.is_future ? 'opacity-50' : ''}`}>
                      <p>{w.weekday}</p>
                      <p title="Goals done">🎯 {w.goals_total ? `${w.goals_completed}/${w.goals_total}` : '–'}</p>
                      <p title="Habits done">🌱 {w.habits_completed}</p>
                      <p title="Sleep">🌙 {w.sleep_minutes ? (w.sleep_minutes / 60).toFixed(1) : '–'}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <div className="space-y-5 lg:col-span-2">
              <TodayMood d={d} reload={q.reload} />

              <Section title="Garden" icon={<Flower2 size={18} className="text-sage-500" />} action={<Link to="/garden" className="text-xs font-bold text-lavender-500 hover:underline">Visit</Link>}>
                <div className="flex items-center gap-4">
                  <ProgressRing value={d.garden.progress_pct} tone="sage" size={84}>
                    <span className="text-[10px] font-bold uppercase text-ink-3">Level</span>
                    <span className="font-display text-2xl font-semibold leading-none">{d.garden.level}</span>
                  </ProgressRing>
                  <div className="text-sm">
                    <p className="font-bold">{d.garden.total_xp} XP</p>
                    <p className="text-ink-2">{d.garden.xp_for_next_level - d.garden.xp_into_level} XP to the next bloom</p>
                    <p className="mt-1 text-xs text-sage-600">+{d.garden.xp_today} XP today · {d.garden.unlocked_count} unlocked</p>
                  </div>
                </div>
              </Section>

              <Section title="To do next" icon={<BookOpen size={18} className="text-lavender-500" />} action={<Link to="/study" className="text-xs font-bold text-lavender-500 hover:underline">Study</Link>}>
                {d.tasks.items.length === 0 ? (
                  <p className="text-sm text-ink-2">Nothing is due or planned for today. Lovely and calm. ✨</p>
                ) : (
                  <ul className="space-y-2">
                    {d.tasks.items.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-soft p-3">
                        <button disabled={busyTopic} onClick={() => finishTopic(t)} aria-label={`Complete ${t.title}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-lavender-200 bg-surface text-transparent hover:border-sage-400 hover:text-sage-500">
                          <Check size={15} strokeWidth={3} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{t.title}</p>
                          <p className="text-xs text-ink-2">
                            {t.subject ? `${t.subject} · ` : ''}
                            {t.deadline ? (t.is_overdue ? `Overdue (${relativeDay(t.deadline)})` : `Due ${relativeDay(t.deadline)}`) : 'Planned for today'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Coming up" icon={<CalendarClock size={18} className="text-blush-500" />} action={<Link to="/calendar" className="text-xs font-bold text-lavender-500 hover:underline">Calendar</Link>}>
                {d.upcoming.length === 0 ? (
                  <p className="text-sm text-ink-2">No deadlines or events in the next two weeks. 🌤️</p>
                ) : (
                  <ul className="space-y-2">
                    {d.upcoming.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">{i.title}</span>
                        <Chip tone={i.item_type === 'exam' ? 'blush' : 'lavender'}>{relativeDay(i.date)}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>
        </div>
      )}
    </AsyncView>
  )
}
