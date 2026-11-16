import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-4xl bg-surface p-6 shadow-lift scroll-soft sm:rounded-4xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-ink-3 hover:bg-soft hover:text-ink">
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', busy }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-ink-2">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Keep it
        </button>
        <button className="btn-primary" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
