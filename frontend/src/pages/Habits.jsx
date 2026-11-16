import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight, Flame, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import PageHeader, { Section, Stat } from '../components/ui/PageHeader'
import { AsyncView, EmptyState } from '../components/ui/States'
import { Chip, Field, ProgressBar, Segmented } from '../components/ui/Form'
import Modal, { ConfirmModal } from '../components/ui/Modal'
import GoalItem from '../components/habits/GoalItem'
import HabitRow from '../components/habits/HabitRow'
import AddGoalForm from '../components/habits/AddGoalForm'
import { COLORS, tickProps, tooltipStyle } from '../utils/chart'
import { addDays, fmtDate, parseISODate, relativeDay, toISODate } from '../utils/date'

const EMOJIS = ['🏃‍♀️', '📖', '💧', '📝', '🧘‍♀️', '🥗', '😴', '🎨', '🎵', '🧹', '🌿', '💊', '🚶‍♀️', '✍️', '🧠', '☀️']
const CATEGORIES = [['exercise', 'Exercise'], ['reading', 'Reading'], ['hydration', 'Hydration'], ['revision', 'Revision'], ['custom', 'Something else']]

function HabitForm({ open, onClose, habit, onSaved }) {
  const blank = { name: '', emoji: '🌸', category: 'custom', target_count: 1, unit: '' }
  const [f, setF] = useState(blank)
  useEffect(() => {
    if (open) setF(habit ? { name: habit.name, emoji: habit.emoji, category: habit.category || 'custom', target_count: habit.target_count, unit: habit.unit || '' } : blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, habit])
  const [save, busy] = useAction(
    async () => {
      const body = { name: f.name, emoji: f.emoji, category: f.category, target_count: Number(f.target_count), unit: f.unit.trim() || null }
      if (habit) await api.patch(`/habits/${habit.id}`, body)
      else await api.post('/habits', body)
      onSaved()
      onClose()
    },
    { success: habit ? 'Habit updated' : 'Habit created 🌱' },
  )
  return (
    <Modal open={open} onClose={onClose} title={habit ? 'Edit habit' : 'New habit'}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
        <Field label="Name"><input className="input" required autoFocus maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Drink water" /></Field>
        <div>
          <span className="label">Pick an emoji</span>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => <button type="button" key={e} aria-pressed={f.emoji === e} onClick={() => setF({ ...f, emoji: e })} className={`h-10 w-10 rounded-xl text-xl transition ${f.emoji === e ? 'bg-blush-200 ring-2 ring-blush-300' : 'bg-soft hover:bg-blush-100'}`}>{e}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Times per day" hint="8 for 8 glasses of water"><input className="input" type="number" min={1} max={100} required value={f.target_count} onChange={(e) => setF({ ...f, target_count: e.target.value })} /></Field>
          <Field label="Unit (optional)"><input className="input" maxLength={30} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="glasses" /></Field>
        </div>
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !f.name.trim()}>{habit ? 'Save' : 'Create habit'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Reports({ version }) {
  const [period, setPeriod] = useState('week')
  const q = useQuery(() => api.get('/habits/report', { period }), [period, version])
  return (
    <Section title="Progress report" icon={<span aria-hidden>📊</span>} action={<Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />}>
      <AsyncView query={q} compact isEmpty={(d) => d.habits.length === 0} empty={<EmptyState compact title="No habits to report on" hint="Create a habit and your progress will show up here." />}>
        {(r) => (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <p className="font-display text-4xl font-semibold text-sage-600">{r.overall_pct}%</p>
              <p className="text-sm text-ink-2">of habits completed {period === 'week' ? 'this week' : 'this month'} so far</p>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.daily.map((d) => ({ label: period === 'month' ? String(+d.date.slice(8)) : fmtDate(d.date, { weekday: 'short' }), done: d.done, total: d.total }))} margin={{ left: -24, right: 4, top: 6 }}>
                  <CartesianGrid vertical={false} stroke={COLORS.grid} />
                  <XAxis dataKey="label" tick={tickProps} axisLine={false} tickLine={false} interval={period === 'month' ? 2 : 0} />
                  <YAxis tick={tickProps} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} formatter={(v, _n, p) => [`${v} of ${p.payload.total}`, 'Habits done']} />
                  <Bar dataKey="done" fill={COLORS.sage} radius={[8, 8, 3, 3]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2.5">
              {r.habits.map((h) => (
                <li key={h.habit_id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-bold">{h.emoji} {h.name}</span>
                    <span className="text-xs text-ink-2">{h.days_done}/{h.days_in_period} days{h.longest_streak > 0 && <> · best streak {h.longest_streak}</>}</span>
                  </div>
                  <ProgressBar value={h.completion_pct} tone="sage" label={`${h.name} completion`} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </AsyncView>
    </Section>
  )
}

function StreakHistory({ version }) {
  const q = useQuery(() => api.get('/achievements'), [version])
  const earned = useMemo(() => (q.data?.achievements || []).filter((a) => a.unlocked && (a.category === 'habit' || a.key.startsWith('study_streak'))).sort((a, b) => b.unlocked_at.localeCompare(a.unlocked_at)), [q.data])
  return (
    <Section title="Streak achievements" icon={<Flame size={18} className="text-blush-500" />}>
      <AsyncView query={q} compact isEmpty={() => earned.length === 0} empty={<EmptyState compact title="Your first streak badge is coming" hint="Keep any habit going for 3 days and it will appear here." />}>
        {() => (
          <ul className="grid gap-2 sm:grid-cols-2">
            {earned.map((a) => (
              <li key={a.key} className="flex items-center gap-3 rounded-2xl bg-soft p-3">
                <span className="text-3xl">{a.icon}</span>
                <div className="min-w-0"><p className="truncate text-sm font-bold">{a.title}</p><p className="text-xs text-ink-2">{relativeDay(a.unlocked_at.slice(0, 10))}</p></div>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </Section>
  )
}

export default function Habits() {
  const [day, setDay] = useState(toISODate())
  const [version, setVersion] = useState(0)
  const [habitForm, setHabitForm] = useState({ open: false, habit: null })
  const [confirm, setConfirm] = useState(null)
  const isToday = day === toISODate()
  const goals = useQuery(() => api.get('/goals', { goal_date: day }), [day, version])
  const habits = useQuery(() => api.get('/habits', { day }), [day, version])
  const refresh = () => setVersion((v) => v + 1)
  const shift = (n) => setDay((d) => toISODate(addDays(parseISODate(d), n)))

  const [toggleGoal, busyGoal] = useAction((g) => api.patch(`/goals/${g.id}`, { is_completed: !g.is_completed }).then(refresh))
  const [deleteGoal] = useAction((g) => api.del(`/goals/${g.id}`).then(refresh), { success: 'Goal removed' })
  const [setCount, busyHabit] = useAction((h, count) => api.put(`/habits/${h.id}/logs/${day}`, { count: Math.max(0, count) }).then(refresh))
  const [removeHabit, removing] = useAction(async () => { await api.del(`/habits/${confirm.id}`); setConfirm(null); refresh() }, { success: 'Habit deleted' })

  const done = goals.data?.filter((g) => g.is_completed).length || 0
  const total = goals.data?.length || 0
  const habitsDone = habits.data?.filter((h) => h.is_done).length || 0
  const bestStreak = Math.max(0, ...(habits.data || []).map((h) => h.current_streak))

  return (
    <>
      <PageHeader
        emoji="🌱"
        title="Goals & Habits"
        subtitle="Small, kind, daily steps. Streaks keep going until a day is fully missed."
        actions={
          <div className="flex items-center gap-1 rounded-2xl bg-surface p-1 shadow-soft">
            <button className="btn-ghost !p-2" onClick={() => shift(-1)} aria-label="Previous day"><ChevronLeft size={18} /></button>
            <span className="min-w-[8rem] text-center text-sm font-bold">{relativeDay(day)}</span>
            <button className="btn-ghost !p-2" onClick={() => shift(1)} disabled={isToday} aria-label="Next day"><ChevronRight size={18} /></button>
          </div>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat stack tone="blush" icon={<Target size={22} />} label="Goals" value={total ? `${done}/${total}` : '–'} />
        <Stat stack tone="sage" icon={<span>🌱</span>} label="Habits" value={`${habitsDone}/${habits.data?.length || 0}`} />
        <Stat stack tone="cream" icon={<Flame size={22} />} label="Top streak" value={bestStreak} sub="days" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={isToday ? "Today's goals" : `Goals for ${fmtDate(day)}`} icon={<Target size={18} className="text-blush-500" />}>
          <AsyncView query={goals} compact isEmpty={() => false}>
            {(list) => (
              <>
                {list.length === 0 && <EmptyState compact title="No goals for this day" hint="Add something small and meaningful." />}
                <ul className="mb-3 space-y-0.5"><AnimatePresence initial={false}>{list.map((g) => <GoalItem key={g.id} goal={g} onToggle={toggleGoal} onDelete={deleteGoal} disabled={busyGoal} />)}</AnimatePresence></ul>
              </>
            )}
          </AsyncView>
          <AddGoalForm goalDate={day} onAdded={refresh} placeholder={isToday ? 'Add a goal for today…' : `Add a goal for ${fmtDate(day)}…`} />
        </Section>

        <Section title="Habits" icon={<span aria-hidden>🌱</span>} action={<button className="btn-soft !px-3 !py-1.5 text-xs" onClick={() => setHabitForm({ open: true, habit: null })}><Plus size={14} /> New habit</button>}>
          <AsyncView query={habits} compact isEmpty={(d) => d.length === 0} empty={<EmptyState compact title="No habits yet" hint="Exercise, reading, water, revision… start with one." action={<button className="btn-primary" onClick={() => setHabitForm({ open: true, habit: null })}>Create a habit</button>} />}>
            {(list) => (
              <ul className="space-y-2.5">
                {list.map((h) => (
                  <HabitRow key={h.id} habit={h} busy={busyHabit} onSetCount={setCount} actions={
                    <div className="flex">
                      <button aria-label={`Edit ${h.name}`} className="rounded-full p-1.5 text-ink-3 hover:bg-surface" onClick={() => setHabitForm({ open: true, habit: h })}><Pencil size={14} /></button>
                      <button aria-label={`Delete ${h.name}`} className="rounded-full p-1.5 text-ink-3 hover:bg-blush-100 hover:text-blush-600" onClick={() => setConfirm(h)}><Trash2 size={14} /></button>
                    </div>
                  } />
                ))}
              </ul>
            )}
          </AsyncView>
        </Section>

        <Reports version={version} />
        <StreakHistory version={version} />
      </div>

      <HabitForm open={habitForm.open} habit={habitForm.habit} onClose={() => setHabitForm({ open: false, habit: null })} onSaved={refresh} />
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={removeHabit} busy={removing} title="Delete this habit?" message={`"${confirm?.name}" and its history will be removed. Your garden XP and badges stay safe.`} />
    </>
  )
}
