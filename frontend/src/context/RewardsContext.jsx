import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const PETALS = ['🌸', '✨', '🌷', '💗', '🌼', '🦋']

function Petals() {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 h-0" aria-hidden>
      {PETALS.map((p, i) => (
        <motion.span
          key={i}
          className="absolute text-xl"
          style={{ left: `${10 + i * 15}%` }}
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 0], y: -60 - (i % 3) * 18, x: (i % 2 ? 1 : -1) * 14, scale: 1, rotate: (i % 2 ? 1 : -1) * 30 }}
          transition={{ duration: 1.8, delay: i * 0.07 }}
        >
          {p}
        </motion.span>
      ))}
    </div>
  )
}

/** Listens for rewards returned by the API and shows a gentle celebration. Never shows anything negative. */
export default function RewardsCelebrations() {
  const [queue, setQueue] = useState([])
  const current = queue[0]

  useEffect(() => {
    const onRewards = (e) => setQueue((q) => [...q, { id: crypto.randomUUID(), ...e.detail }])
    window.addEventListener('hlu:rewards', onRewards)
    return () => window.removeEventListener('hlu:rewards', onRewards)
  }, [])

  useEffect(() => {
    if (!current) return
    const big = current.leveled_up || current.new_items?.length || current.new_achievements?.length
    const t = setTimeout(() => setQueue((q) => q.slice(1)), big ? 5200 : 2600)
    return () => clearTimeout(t)
  }, [current])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 md:bottom-8">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="pointer-events-auto relative w-full max-w-sm rounded-3xl border border-blush-200 bg-surface p-4 shadow-lift"
            role="status"
          >
            <Petals />
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blush-100 text-blush-500">
                <Sparkles size={22} />
              </div>
              <div className="min-w-0 flex-1">
                {current.xp_gained > 0 && <p className="font-display text-lg font-semibold">+{current.xp_gained} garden XP 🌱</p>}
                {current.leveled_up && <p className="text-sm font-bold text-lavender-500">Your garden reached level {current.level}! 🎉</p>}
                {current.new_items?.map((i) => (
                  <p key={i.key} className="text-sm font-semibold text-sage-600">
                    {i.emoji} New in your garden: {i.name}
                  </p>
                ))}
                {current.new_achievements?.map((a) => (
                  <p key={a.key} className="text-sm font-semibold text-blush-600">
                    {a.icon} Badge unlocked: {a.title}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
