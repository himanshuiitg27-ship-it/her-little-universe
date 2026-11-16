import { useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarArrowUp } from 'lucide-react'
import { api } from '../../api/client'
import { useAction } from '../../hooks/useAction'
import { relativeDay, toISODate } from '../../utils/date'
import { Section } from '../ui/PageHeader'

/** Unfinished topics from earlier days. Nothing moves until she chooses what and where. */
export default function CarryForward({ topics, onDone }) {
  const [picked, setPicked] = useState(() => new Set(topics.map((t) => t.id)))
  const [target, setTarget] = useState(toISODate())
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const [move, busy] = useAction(
    async () => {
      const r = await api.post('/study/carry-forward', { topic_ids: [...picked], target_date: target })
      onDone?.()
      return r
    },
    { success: (r) => `Moved ${r.moved} ${r.moved === 1 ? 'topic' : 'topics'} to ${relativeDay(target).toLowerCase()} 🌿` },
  )
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Section title="Pick up where you left off" icon={<CalendarArrowUp size={18} className="text-lavender-500" />} className="!border-lavender-200 !bg-lavender-50">
        <p className="mb-3 text-sm text-ink-2">These were planned for earlier days and aren't finished yet. Choose which ones to bring forward. Skipping is completely fine.</p>
        <ul className="mb-4 space-y-1.5">
          {topics.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface/70 px-3 py-2">
                <input type="checkbox" className="h-4 w-4 accent-lavender-400" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="flex-1 truncate text-sm font-semibold">{t.title}</span>
                <span className="text-xs text-ink-3">planned {relativeDay(t.planned_date).toLowerCase()}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label">Move to</span>
            <input type="date" className="input" min={toISODate()} value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy || picked.size === 0 || !target} onClick={() => move()}>
            Move {picked.size} selected
          </button>
        </div>
      </Section>
    </motion.div>
  )
}
