import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import PageHeader, { Section, Stat } from '../components/ui/PageHeader'
import { AsyncView, EmptyState } from '../components/ui/States'
import { Chip, ProgressBar, Segmented } from '../components/ui/Form'
import { fmtMinutes, relativeDay } from '../utils/date'

const CATS = [{ value: 'all', label: 'All' }, { value: 'study', label: '📚 Study' }, { value: 'daily', label: '🌈 Daily' }, { value: 'habit', label: '🌱 Habits' }, { value: 'wellness', label: '🌙 Wellness' }, { value: 'garden', label: '🌷 Garden' }]

function Badge({ a, i }) {
  return (
    <motion.li initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }} whileHover={{ y: -3 }} className={`card flex flex-col items-center gap-1.5 !p-4 text-center ${a.unlocked ? '!border-blush-200' : ''}`}>
      <div className={`relative grid h-16 w-16 place-items-center rounded-full text-4xl ${a.unlocked ? 'bg-gradient-to-br from-blush-100 to-lavender-100 shadow-soft' : 'bg-soft'}`}>
        <span className={a.unlocked ? '' : 'opacity-30 grayscale'}>{a.icon}</span>
        {!a.unlocked && <Lock size={13} className="absolute bottom-0 right-0 rounded-full bg-surface p-0.5 text-ink-3" />}
      </div>
      <p className="font-display text-sm font-semibold leading-tight">{a.title}</p>
      <p className="text-[11px] leading-snug text-ink-2">{a.description}</p>
      {a.unlocked ? <Chip tone="sage">Earned {relativeDay(a.unlocked_at.slice(0, 10)).toLowerCase()}</Chip> : (
        <div className="w-full"><ProgressBar value={a.progress_pct} tone="lavender" label={`${a.title} progress`} /><p className="mt-1 text-[10px] font-bold text-ink-3">{a.value} / {a.threshold}</p></div>
      )}
    </motion.li>
  )
}

function MonthlySummary() {
  const [offset, setOffset] = useState(0)
  const month = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }, [offset])
  const q = useQuery(() => api.get('/achievements/summary', { month }), [month])
  const label = new Date(`${month}-01T00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return (
    <Section title="Monthly summary" icon={<span aria-hidden>🗓️</span>} action={
      <div className="flex items-center gap-1">
        <button className="btn-ghost !p-1.5" onClick={() => setOffset((o) => o - 1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <span className="min-w-[7.5rem] text-center text-sm font-bold">{label}</span>
        <button className="btn-ghost !p-1.5" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>}>
      <AsyncView query={q} compact>
        {(s) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat tone="lavender" icon={<span>📚</span>} label="Studied" value={fmtMinutes(s.study_minutes)} sub={`${s.study_days} active days`} />
              <Stat tone="blush" icon={<span>🎯</span>} label="Goals done" value={`${s.goals_completed}/${s.goals_total}`} sub={`${s.topics_completed} topics finished`} />
              <Stat tone="sage" icon={<span>🌱</span>} label="Habits" value={`${s.habit_completion_pct}%`} sub="completion" />
              <Stat tone="cream" icon={<span>🌷</span>} label="Garden XP" value={`+${s.xp_earned}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-center text-sm md:grid-cols-4">
              <div className="rounded-2xl bg-soft p-3"><p className="text-xs font-bold text-ink-3">Avg sleep</p><p className="font-display text-lg font-semibold">{s.average_sleep_minutes ? fmtMinutes(s.average_sleep_minutes) : '–'}</p></div>
              <div className="rounded-2xl bg-soft p-3"><p className="text-xs font-bold text-ink-3">Avg mood</p><p className="font-display text-lg font-semibold">{s.average_mood_score ? `${s.average_mood_score}/5` : '–'}</p></div>
              <div className="rounded-2xl bg-soft p-3"><p className="text-xs font-bold text-ink-3">Journal entries</p><p className="font-display text-lg font-semibold">{s.journal_entries}</p></div>
              <div className="rounded-2xl bg-soft p-3"><p className="text-xs font-bold text-ink-3">Night reflections</p><p className="font-display text-lg font-semibold">{s.reflections}</p></div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Badges earned this month</p>
              {s.badges_earned.length === 0 ? <p className="text-sm text-ink-3">None this month yet. Plenty of time. 🌸</p> : <div className="flex flex-wrap gap-2">{s.badges_earned.map((b) => <Chip key={b.key} tone="blush">{b.icon} {b.title}</Chip>)}</div>}
            </div>
          </div>
        )}
      </AsyncView>
    </Section>
  )
}

export default function Achievements() {
  const q = useQuery(() => api.get('/achievements'), [])
  const [cat, setCat] = useState('all')
  return (
    <>
      <PageHeader emoji="🏆" title="Achievement Center" subtitle="Proof of how far you've come. Badges only ever get added, never taken away." />
      <AsyncView query={q}>
        {(d) => {
          const list = d.achievements.filter((a) => cat === 'all' || a.category === cat)
          return (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <Stat tone="blush" icon={<span>🏅</span>} label="Badges earned" value={`${d.unlocked_count}/${d.total_count}`} />
                <Stat tone="lavender" icon={<span>☀️</span>} label="Earned today" value={d.today.length} sub={d.today.map((a) => a.title).join(', ') || 'Today could be the day'} />
                <Stat tone="sage" icon={<span>📅</span>} label="Earned this week" value={d.this_week.length} sub={d.this_week.slice(0, 3).map((a) => a.title).join(', ') || undefined} />
              </div>
              <MonthlySummary />
              <div className="overflow-x-auto pb-1"><Segmented value={cat} onChange={setCat} options={CATS} size="sm" /></div>
              {list.length === 0 ? <EmptyState title="Nothing in this category" /> : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[...list].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progress_pct - a.progress_pct).map((a, i) => <Badge key={a.key} a={a} i={i} />)}</ul>
              )}
            </div>
          )
        }}
      </AsyncView>
    </>
  )
}
