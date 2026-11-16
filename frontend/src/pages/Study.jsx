import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Check, Clock, Lightbulb, Pencil, Play, Plus, Sparkles, Timer, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import PageHeader, { Section } from '../components/ui/PageHeader'
import { AsyncView, EmptyState } from '../components/ui/States'
import { Chip, ProgressBar, Segmented } from '../components/ui/Form'
import { ConfirmModal } from '../components/ui/Modal'
import TopicForm from '../components/study/TopicForm'
import Pomodoro from '../components/study/Pomodoro'
import CarryForward from '../components/study/CarryForward'
import StudyInsights from '../components/study/StudyInsights'
import LogTimeModal from '../components/study/LogTimeModal'
import PlannerModal from '../components/study/PlannerModal'
import { fmtMinutes, relativeDay } from '../utils/date'

const PRIORITY = { high: { tone: 'blush', label: '🔥 High' }, medium: { tone: 'lavender', label: '🌷 Medium' }, low: { tone: 'sage', label: '🌿 Low' } }

function TopicCard({ t, onComplete, onEdit, onDelete, onFocus, onLog, busy }) {
  const pct = Math.min(100, (t.actual_minutes / t.estimated_minutes) * 100)
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className={`card !p-4 ${t.is_completed ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <button disabled={busy} onClick={() => onComplete(t)} aria-pressed={t.is_completed} aria-label={t.is_completed ? `Mark ${t.title} as not finished` : `Finish ${t.title}`} className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${t.is_completed ? 'border-sage-400 bg-sage-400 text-white' : 'border-lavender-200 bg-surface text-transparent hover:border-sage-400 hover:text-sage-500'}`}>
          <Check size={15} strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`font-bold ${t.is_completed ? 'line-through' : ''}`}>{t.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {t.subject && <Chip tone="cream">{t.subject}</Chip>}
            <Chip tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Chip>
            {t.deadline && <Chip tone={t.is_overdue ? 'blush' : 'neutral'}>{t.is_overdue ? '⏰ Overdue · ' : '📅 '}{relativeDay(t.deadline)}</Chip>}
            {t.planned_date && !t.is_completed && <Chip tone="lavender">🗓️ {relativeDay(t.planned_date)}</Chip>}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={pct} tone={pct >= 100 ? 'sage' : 'lavender'} className="flex-1" label="Time studied" />
            <span className="shrink-0 text-xs font-bold text-ink-2">{fmtMinutes(t.actual_minutes)} / {fmtMinutes(t.estimated_minutes)}</span>
          </div>
          {t.notes && <p className="mt-2 text-xs text-ink-2">{t.notes}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-1.5">
        {!t.is_completed && <button className="btn-lavender !px-3 !py-1.5 text-xs" onClick={() => onFocus(t)}><Play size={14} /> Focus</button>}
        {!t.is_completed && <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => onLog(t)}><Clock size={14} /> Log time</button>}
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => onEdit(t)}><Pencil size={14} /> Edit</button>
        <button className="btn-ghost !px-3 !py-1.5 text-xs hover:!text-blush-600" onClick={() => onDelete(t)}><Trash2 size={14} /> Delete</button>
      </div>
    </motion.li>
  )
}

export default function Study() {
  const { settings } = useSettings()
  const toast = useToast()
  const [tab, setTab] = useState('plan')
  const [filter, setFilter] = useState('pending')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ open: false, topic: null })
  const [logModal, setLogModal] = useState({ open: false, topicId: null })
  const [confirm, setConfirm] = useState(null)
  const [planner, setPlanner] = useState(false)

  const topics = useQuery(() => api.get('/study/topics'), [version])
  const carry = useQuery(() => api.get('/study/carry-forward'), [version])
  const suggestions = useQuery(() => api.get('/study/prioritized', { limit: 3 }), [version])
  const aiStatus = useQuery(() => api.get('/ai/status'), [])
  const refresh = () => setVersion((v) => v + 1)

  const [complete, busy] = useAction((t) => api.patch(`/study/topics/${t.id}`, { is_completed: !t.is_completed }).then(refresh))
  const [remove, removing] = useAction(async () => { await api.del(`/study/topics/${confirm.id}`); setConfirm(null); refresh() }, { success: 'Topic deleted' })

  const subjects = useMemo(() => [...new Set((topics.data || []).map((t) => t.subject).filter(Boolean))], [topics.data])
  const visible = useMemo(() => (topics.data || []).filter((t) => (filter === 'all' ? true : filter === 'pending' ? !t.is_completed : t.is_completed)), [topics.data, filter])

  const startFocus = (t) => {
    try {
      const saved = JSON.parse(localStorage.getItem('hlu-pomodoro') || '{}')
      localStorage.setItem('hlu-pomodoro', JSON.stringify({ ...saved, topicId: t.id, running: false, endsAt: null }))
    } catch { /* ignore */ }
    setTab('focus')
  }
  const openPlanner = () => (aiStatus.data?.enabled ? setPlanner(true) : toast.info(aiStatus.data?.reason || 'AI planning is not available right now.'))

  return (
    <>
      <PageHeader
        emoji="📚"
        title="Study"
        subtitle="Plan gently, focus deeply, and watch your effort add up."
        actions={
          <>
            <button className="btn-lavender" onClick={openPlanner}><Sparkles size={16} /> AI plan</button>
            <button className="btn-soft" onClick={() => setLogModal({ open: true, topicId: null })}><Clock size={16} /> Log time</button>
            <button className="btn-primary" onClick={() => setForm({ open: true, topic: null })}><Plus size={16} /> New topic</button>
          </>
        }
      />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'plan', label: 'Plan', icon: <Lightbulb size={15} /> }, { value: 'focus', label: 'Focus', icon: <Timer size={15} /> }, { value: 'insights', label: 'Insights', icon: <BarChart3 size={15} /> }]} />

      {tab === 'plan' && (
        <div className="space-y-5">
          {carry.data?.length > 0 && <CarryForward key={carry.data.map((t) => t.id).join()} topics={carry.data} onDone={refresh} />}

          {suggestions.data?.length > 0 && (
            <Section title="Suggested order" icon={<Lightbulb size={18} className="text-blush-500" />}>
              <p className="mb-3 text-xs text-ink-3">Based on priority, deadlines and how much is left. Just a nudge, you decide.</p>
              <ol className="grid gap-2.5 md:grid-cols-3">
                {suggestions.data.map((s, i) => (
                  <li key={s.topic.id} className="rounded-2xl bg-soft p-3.5">
                    <p className="text-xs font-bold text-lavender-500">#{i + 1}</p>
                    <p className="font-bold leading-snug">{s.topic.title}</p>
                    <p className="mt-1 text-xs text-ink-2">{s.reasons.slice(0, 2).join(' · ')}</p>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <div className="flex items-center justify-between gap-3">
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'pending', label: 'To do' }, { value: 'completed', label: 'Done' }, { value: 'all', label: 'All' }]} />
          </div>
          <AsyncView
            query={topics}
            isEmpty={() => visible.length === 0}
            empty={
              <EmptyState
                title={filter === 'completed' ? 'Nothing finished yet' : 'No topics yet'}
                hint={filter === 'completed' ? 'Finished topics will rest here.' : 'Add what you want to study, with a deadline and an estimate, and I will help you order it.'}
                action={filter !== 'completed' && <button className="btn-primary" onClick={() => setForm({ open: true, topic: null })}><Plus size={16} /> Add your first topic</button>}
              />
            }
          >
            {() => (
              <ul className="grid gap-3 lg:grid-cols-2">
                <AnimatePresence initial={false}>
                  {visible.map((t) => (
                    <TopicCard key={t.id} t={t} busy={busy} onComplete={complete} onEdit={(x) => setForm({ open: true, topic: x })} onDelete={setConfirm} onFocus={startFocus} onLog={(x) => setLogModal({ open: true, topicId: x.id })} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </AsyncView>
        </div>
      )}

      {tab === 'focus' && <Pomodoro settings={settings} topics={topics.data || []} onSaved={refresh} />}
      {tab === 'insights' && <StudyInsights refreshKey={version} onChanged={refresh} />}

      <TopicForm open={form.open} topic={form.topic} subjects={subjects} onClose={() => setForm({ open: false, topic: null })} onSaved={refresh} />
      <LogTimeModal open={logModal.open} defaultTopicId={logModal.topicId} topics={topics.data || []} onClose={() => setLogModal({ open: false, topicId: null })} onSaved={refresh} />
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={remove} busy={removing} title="Delete this topic?" message={`"${confirm?.title}" will be removed. Time you already studied on it stays in your stats.`} />
      <PlannerModal key={String(planner)} open={planner} onClose={() => setPlanner(false)} defaultMinutes={settings.daily_study_goal_minutes} onApplied={refresh} />
    </>
  )
}
