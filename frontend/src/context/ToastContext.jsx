import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

const STYLES = {
  success: { icon: CheckCircle2, cls: 'bg-sage-100 text-sage-600 border-sage-200' },
  error: { icon: AlertCircle, cls: 'bg-blush-100 text-blush-600 border-blush-200' },
  info: { icon: Info, cls: 'bg-lavender-100 text-lavender-600 border-lavender-200' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (type, message, ms = 3800) => {
      const id = crypto.randomUUID()
      setToasts((t) => [...t.slice(-3), { id, type, message }])
      setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )
  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m, 6000),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 md:top-5">
        <AnimatePresence>
          {toasts.map((t) => {
            const { icon: Icon, cls } = STYLES[t.type]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                role={t.type === 'error' ? 'alert' : 'status'}
                className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lift ${cls}`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="flex-1">{t.message}</span>
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
                  <X size={16} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
