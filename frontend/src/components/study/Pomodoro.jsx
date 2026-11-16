import { motion } from 'framer-motion'
import { Coffee, Flag, Pause, Play, RotateCcw } from 'lucide-react'
import { api } from '../../api/client'
import { useAction } from '../../hooks/useAction'
import { usePomodoro } from '../../hooks/usePomodoro'
import { useToast } from '../../context/ToastContext'
import { ProgressRing, Segmented } from '../ui/Form'

const MODES = [
  { value: 'focus', label: 'Focus' },
  { value: 'short', label: 'Short break' },
  { value: 'long', label: 'Long break' },
]

export default function Pomodoro({ settings, topics, onSaved }) {
  const toast = useToast()
  const [save] = useAction(async ({ minutes, startedAt, topicId }) => {
    if (minutes < 1) return
    await api.post('/study/sessions', { duration_minutes: minutes, kind: 'pomodoro', topic_id: topicId || null, started_at: startedAt })
    toast.success(`Saved ${minutes} focused minutes 🌸`)
    onSaved?.()
  })
  const p = usePomodoro(settings, save)
  const secs = Math.ceil(p.remainingMs / 1000)
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const isFocus = p.mode === 'focus'
  const pending = topics.filter((t) => !t.is_completed)
  const canFinishEarly = isFocus && p.startedAt && Math.floor((p.totalMs - p.remainingMs) / 60_000) >= 1

  return (
    <div className="card mx-auto max-w-xl text-center">
      <Segmented className="mb-6" options={MODES} value={p.mode} onChange={p.setMode} size="sm" />
      <div className="flex justify-center">
        <ProgressRing value={p.progress * 100} size={240} stroke={14} tone={isFocus ? 'blush' : 'sage'}>
          <motion.span key={p.running} animate={p.running ? { scale: [1, 1.02, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }} className="font-display text-6xl font-semibold tabular-nums" aria-live="off">
            {clock}
          </motion.span>
          <span className="mt-1 flex items-center gap-1 text-sm font-bold text-ink-3">
            {isFocus ? <>🌸 Focus</> : <><Coffee size={14} /> Rest</>}
          </span>
        </ProgressRing>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button className="btn-ghost !h-12 !w-12 !rounded-full !p-0" onClick={p.reset} aria-label="Reset timer">
          <RotateCcw size={20} />
        </button>
        <button className="btn-primary !h-16 !w-16 !rounded-full !p-0" onClick={p.running ? p.pause : p.start} aria-label={p.running ? 'Pause' : 'Start'}>
          {p.running ? <Pause size={26} /> : <Play size={26} className="ml-0.5" />}
        </button>
        <button
          className="btn-ghost !h-12 !w-12 !rounded-full !p-0"
          disabled={!canFinishEarly}
          onClick={() => {
            const info = p.finishEarly()
            save(info)
          }}
          aria-label="Finish early and save"
          title="Finish early and save the time so far"
        >
          <Flag size={20} />
        </button>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        {p.cycles} focus {p.cycles === 1 ? 'round' : 'rounds'} today · {p.minutesFor('focus')} min focus / {p.minutesFor('short')} min break (change in Settings)
      </p>

      <div className="mx-auto mt-5 max-w-xs text-left">
        <label className="label" htmlFor="pomo-topic">What are you studying?</label>
        <select id="pomo-topic" className="input" value={p.topicId || ''} onChange={(e) => p.setTopic(e.target.value || null)}>
          <option value="">General study</option>
          {pending.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
