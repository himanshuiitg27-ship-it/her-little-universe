import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { ErrorState, Loading } from './ui/States'

export default function MoodPicker({ value, onPick, disabled, compact = false }) {
  const q = useQuery(() => api.get('/mood/options'), [])
  if (q.loading) return <Loading compact label="Loading moods…" />
  if (q.error) return <ErrorState compact error={q.error} onRetry={q.retry} />
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-5' : 'grid-cols-5 sm:grid-cols-5'}`} role="radiogroup" aria-label="How are you feeling?">
      {q.data.map((m) => {
        const active = value === m.key
        return (
          <motion.button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onPick(m.key)}
            className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-0.5 py-2.5 transition ${active ? 'border-blush-300 bg-blush-100' : 'border-transparent bg-soft hover:border-lavender-200'}`}
          >
            <span className={compact ? 'text-2xl' : 'text-3xl'}>{m.emoji}</span>
            <span className="max-w-full truncate text-[10px] font-bold text-ink-2 sm:text-[11px]">{m.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
