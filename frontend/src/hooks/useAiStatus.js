import { useEffect, useState } from 'react'
import { api } from '../api/client'

let cache = null
/** Whether the Groq-powered features are available (key configured and not switched off). */
export function useAiStatus() {
  const [status, setStatus] = useState(cache)
  useEffect(() => {
    let alive = true
    api.get('/ai/status').then((s) => { cache = s; alive && setStatus(s) }).catch(() => {})
    const refresh = () => { cache = null; api.get('/ai/status').then((s) => { cache = s; alive && setStatus(s) }).catch(() => {}) }
    window.addEventListener('hlu:settings-changed', refresh)
    return () => { alive = false; window.removeEventListener('hlu:settings-changed', refresh) }
  }, [])
  return status
}
