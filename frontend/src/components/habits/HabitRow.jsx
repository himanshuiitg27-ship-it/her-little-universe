import { motion } from 'framer-motion'
import { Check, Flame, Minus, Plus } from 'lucide-react'
import { ProgressBar } from '../ui/Form'

export default function HabitRow({ habit, onSetCount, busy, actions }) {
  const multi = habit.target_count > 1
  const pct = Math.min(100, (habit.count / habit.target_count) * 100)
  return (
    <li className="rounded-2xl bg-soft p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface text-2xl shadow-soft" aria-hidden>
          {habit.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{habit.name}</p>
            {habit.current_streak > 0 && (
              <span className="chip bg-cream-200 text-ink-2" title={`Longest streak: ${habit.longest_streak}`}>
                <Flame size={12} className="text-blush-500" />
                {habit.current_streak}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-2">
            {habit.count}/{habit.target_count} {habit.unit || (multi ? 'times' : 'today')}
          </p>
        </div>
        {actions}
        {multi ? (
          <div className="flex items-center gap-1">
            <button disabled={busy || habit.count <= 0} onClick={() => onSetCount(habit, habit.count - 1)} aria-label={`Remove one from ${habit.name}`} className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-ink-2 hover:bg-blush-100 disabled:opacity-40">
              <Minus size={16} />
            </button>
            <button disabled={busy} onClick={() => onSetCount(habit, habit.count + 1)} aria-label={`Add one to ${habit.name}`} className="grid h-9 w-9 place-items-center rounded-xl bg-blush-300 text-white hover:bg-blush-400">
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={() => onSetCount(habit, habit.is_done ? 0 : 1)}
            aria-pressed={habit.is_done}
            aria-label={habit.is_done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
            className={`grid h-10 w-10 place-items-center rounded-2xl border-2 transition ${habit.is_done ? 'border-sage-400 bg-sage-400 text-white' : 'border-blush-200 bg-surface text-transparent hover:border-blush-300'}`}
          >
            <motion.span initial={false} animate={{ scale: habit.is_done ? 1 : 0.4 }}>
              <Check size={18} strokeWidth={3} />
            </motion.span>
          </button>
        )}
      </div>
      {multi && <ProgressBar className="mt-2.5" value={pct} tone={habit.is_done ? 'sage' : 'blush'} label={`${habit.name} progress`} />}
      <div className="mt-2.5 flex items-center gap-1" aria-label="Last 7 days">
        {habit.last_7_days.map((done, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${done ? 'bg-sage-300' : 'bg-line'}`} />
        ))}
      </div>
    </li>
  )
}
