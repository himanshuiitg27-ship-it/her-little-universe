import { motion } from 'framer-motion'
import { Check, Trash2 } from 'lucide-react'

export default function GoalItem({ goal, onToggle, onDelete, disabled }) {
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="group flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-soft">
      <button
        onClick={() => onToggle(goal)}
        disabled={disabled}
        aria-pressed={goal.is_completed}
        aria-label={goal.is_completed ? `Mark "${goal.title}" as not done` : `Mark "${goal.title}" as done`}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${goal.is_completed ? 'border-sage-400 bg-sage-400 text-white' : 'border-blush-200 bg-surface hover:border-blush-300'}`}
      >
        <motion.span initial={false} animate={{ scale: goal.is_completed ? 1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
          <Check size={16} strokeWidth={3} />
        </motion.span>
      </button>
      <span className={`flex-1 text-sm font-semibold transition ${goal.is_completed ? 'text-ink-3 line-through' : ''}`}>{goal.title}</span>
      {onDelete && (
        <button onClick={() => onDelete(goal)} aria-label={`Delete "${goal.title}"`} className="rounded-full p-1.5 text-ink-3 opacity-100 transition hover:bg-blush-100 hover:text-blush-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">
          <Trash2 size={15} />
        </button>
      )}
    </motion.li>
  )
}
