import { useState } from 'react'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { api } from '../../api/client'
import { useAction } from '../../hooks/useAction'
import { fmtDate, fmtMinutes } from '../../utils/date'
import Modal from '../ui/Modal'
import { Chip, Field } from '../ui/Form'

export default function PlannerModal({ open, onClose, defaultMinutes, onApplied }) {
  const [f, setF] = useState({ days: 7, daily: defaultMinutes, notes: '' })
  const [plan, setPlan] = useState(null)

  const [generate, generating] = useAction(async () => {
    setPlan(null)
    setPlan(await api.post('/ai/study-plan', { days: Number(f.days), daily_minutes: Number(f.daily), notes: f.notes.trim() || null }))
  })
  const [apply, applying] = useAction(
    async () => {
      const assignments = plan.days.flatMap((d) => d.blocks.map((b) => ({ topic_id: b.topic_id, date: d.date })))
      const r = await api.post('/ai/study-plan/apply', { assignments })
      onApplied?.()
      onClose()
      return r
    },
    { success: (r) => `Plan saved: ${r.updated} topics scheduled 🗓️` },
  )

  return (
    <Modal open={open} onClose={onClose} title="AI study planner" wide>
      <form onSubmit={(e) => { e.preventDefault(); generate() }} className="grid gap-3 sm:grid-cols-3">
        <Field label="Days to plan"><input className="input" type="number" min={1} max={14} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field>
        <Field label="Minutes per day"><input className="input" type="number" min={30} max={720} step={15} value={f.daily} onChange={(e) => setF({ ...f, daily: e.target.value })} /></Field>
        <div className="flex items-end"><button className="btn-primary w-full" disabled={generating}><Sparkles size={16} />{generating ? 'Planning…' : plan ? 'Re-plan' : 'Build my plan'}</button></div>
        <Field className="sm:col-span-3" label="Anything I should know? (optional)"><input className="input" maxLength={600} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. I have a lab on Wednesday, so keep it light" /></Field>
      </form>

      {plan && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-lavender-50 p-4">
            <p className="text-sm font-semibold">{plan.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip tone={plan.source === 'ai' ? 'lavender' : 'cream'}>{plan.source === 'ai' ? '✨ AI-planned' : 'Priority-based plan'}</Chip>
              {plan.attempts > 0 && <Chip tone="neutral">Refined {plan.attempts}×</Chip>}
            </div>
          </div>
          {plan.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 rounded-2xl bg-cream-200 p-3 text-sm text-ink-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{w}</p>
          ))}
          <ul className="space-y-3">
            {plan.days.map((d) => (
              <li key={d.date} className="rounded-2xl border border-line p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-display font-semibold">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                  <Chip tone="sage">{fmtMinutes(d.total_minutes)}</Chip>
                </div>
                <ul className="space-y-1.5">
                  {d.blocks.map((b, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <span><b>{b.title}</b>{b.focus && <span className="text-ink-2"> · {b.focus}</span>}</span>
                      <span className="shrink-0 font-bold text-lavender-500">{b.minutes}m</span>
                    </li>
                  ))}
                </ul>
                {d.tip && <p className="mt-2 text-xs text-ink-3">💡 {d.tip}</p>}
              </li>
            ))}
          </ul>
          {plan.unscheduled.length > 0 && (
            <div className="text-sm text-ink-2">
              <p className="font-bold">Not scheduled</p>
              <ul className="list-inside list-disc">{plan.unscheduled.map((u) => <li key={u.topic_id}>{u.title} <span className="text-ink-3">({u.reason})</span></li>)}</ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Not now</button>
            <button className="btn-primary" disabled={applying || plan.days.length === 0} onClick={() => apply()}>Use this plan</button>
          </div>
          <p className="text-xs text-ink-3">"Use this plan" sets each topic's planned date. You can change anything later.</p>
        </div>
      )}
    </Modal>
  )
}
