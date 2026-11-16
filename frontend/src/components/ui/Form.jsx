import { motion } from 'framer-motion'

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export function Segmented({ options, value, onChange, className = '', size = 'md' }) {
  return (
    <div className={`inline-flex rounded-2xl bg-soft p-1 ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative rounded-xl font-bold transition ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}
          >
            {active && <motion.span layoutId={`seg-${options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-xl bg-surface shadow-soft" transition={{ type: 'spring', damping: 28, stiffness: 400 }} />}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-sage-400' : 'bg-line'} disabled:opacity-50`}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  )
}

export function Chip({ children, tone = 'blush', className = '' }) {
  const tones = {
    blush: 'bg-blush-100 text-blush-600',
    lavender: 'bg-lavender-100 text-lavender-600',
    sage: 'bg-sage-100 text-sage-600',
    cream: 'bg-cream-200 text-ink-2',
    neutral: 'bg-soft text-ink-2',
  }
  return <span className={`chip ${tones[tone]} ${className}`}>{children}</span>
}

export function ProgressBar({ value, tone = 'blush', className = '', label }) {
  const fill = { blush: 'bg-blush-300', lavender: 'bg-lavender-300', sage: 'bg-sage-400' }[tone]
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-soft ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div className={`h-full rounded-full ${fill}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
    </div>
  )
}

export function ProgressRing({ value, size = 96, stroke = 10, tone = 'blush', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = { blush: 'rgb(var(--blush-400))', lavender: 'rgb(var(--lavender-400))', sage: 'rgb(var(--sage-400))' }[tone]
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'rgb(var(--line))' }} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ stroke: color }}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(100, Math.max(0, value)) / 100) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
