import { motion } from 'framer-motion'

export default function PageHeader({ emoji, title, subtitle, actions }) {
  return (
    <motion.header initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold md:text-4xl">
          {emoji && <span aria-hidden>{emoji}</span>}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2 md:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  )
}

export function Section({ title, icon, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {icon}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ icon, label, value, sub, tone = 'blush', stack = false }) {
  const tones = { blush: 'bg-blush-100 text-blush-500', lavender: 'bg-lavender-100 text-lavender-500', sage: 'bg-sage-100 text-sage-500', cream: 'bg-cream-200 text-ink-2' }
  return (
    <div className={`card flex min-w-0 gap-4 !p-4 ${stack ? 'flex-col items-start !gap-2 sm:flex-row sm:items-center sm:!gap-4' : 'items-center'}`}>
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0 max-w-full">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-3">{label}</p>
        <p className="font-display text-2xl font-semibold leading-tight">{value}</p>
        {sub && <p className="truncate text-xs text-ink-2">{sub}</p>}
      </div>
    </div>
  )
}
