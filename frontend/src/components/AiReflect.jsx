import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { useAction } from '../hooks/useAction'
import { useAiStatus } from '../hooks/useAiStatus'

/** Optional supportive reflection. Hidden entirely when AI isn't available. */
export default function AiReflect({ source, id, existing, onDone }) {
  const ai = useAiStatus()
  const [text, setText] = useState(existing || null)
  const [ask, busy] = useAction(async () => {
    const r = await api.post('/ai/reflect', { source, id })
    setText(r.reflection)
    onDone?.()
  })
  if (!text && !ai?.enabled) return null
  return (
    <div className="mt-3">
      {text && (
        <div className="rounded-2xl bg-lavender-50 p-3.5 text-sm leading-relaxed text-ink-2">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-lavender-500"><Sparkles size={13} /> A gentle reflection</p>
          <p className="whitespace-pre-line">{text}</p>
        </div>
      )}
      {ai?.enabled && (
        <button className="btn-ghost mt-1.5 !px-2 !py-1.5 text-xs" disabled={busy} onClick={() => ask()}>
          <Sparkles size={14} /> {busy ? 'Reflecting…' : text ? 'Reflect again' : 'Reflect with me'}
        </button>
      )}
    </div>
  )
}
