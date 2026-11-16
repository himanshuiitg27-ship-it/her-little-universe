import { useCallback, useState } from 'react'
import { useToast } from '../context/ToastContext'

/** Wraps an async action with a busy flag and an error toast. Returns [run, busy]. */
export function useAction(fn, { success, onError } = {}) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const run = useCallback(
    async (...args) => {
      setBusy(true)
      try {
        const result = await fn(...args)
        if (success) toast.success(typeof success === 'function' ? success(result) : success)
        return result ?? true
      } catch (e) {
        toast.error(e.message || 'Something went wrong')
        onError?.(e)
        return false
      } finally {
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, success],
  )
  return [run, busy]
}
