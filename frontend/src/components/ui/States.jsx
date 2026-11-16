import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import Mascot from './Mascot'

export function Loading({ label = 'Gathering your little universe…', compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-ink-3 ${compact ? 'py-8' : 'py-20'}`} role="status" aria-live="polite">
      <Mascot size={compact ? 52 : 72} mood="calm" />
      <p className="text-sm font-semibold">{label}</p>
    </div>
  )
}

export function ErrorState({ error, onRetry, compact = false }) {
  return (
    <div className={`flex flex-col items-center gap-3 text-center ${compact ? 'py-8' : 'py-16'}`} role="alert">
      <Mascot size={compact ? 52 : 72} mood="sad" float={false} />
      <div>
        <p className="font-display text-lg font-semibold">Oh no, that didn't load</p>
        <p className="mt-1 max-w-sm text-sm text-ink-2">{error?.message || 'Something went wrong.'}</p>
      </div>
      {onRetry && (
        <button className="btn-soft" onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint, action, mood = 'happy', compact = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center gap-3 text-center ${compact ? 'py-6' : 'py-12'}`}
    >
      <Mascot size={compact ? 56 : 80} mood={mood} />
      <div>
        <p className="font-display text-lg font-semibold">{title}</p>
        {hint && <p className="mt-1 max-w-xs text-sm text-ink-2">{hint}</p>}
      </div>
      {action}
    </motion.div>
  )
}

/** Standard loading / error / empty handling around a useQuery result. */
export function AsyncView({ query, isEmpty, empty, compact, loadingLabel, children }) {
  if (query.loading && !query.data) return <Loading compact={compact} label={loadingLabel} />
  if (query.error && !query.data) return <ErrorState error={query.error} onRetry={query.retry} compact={compact} />
  if (!query.data) return null
  if (isEmpty?.(query.data)) return empty
  return children(query.data)
}
