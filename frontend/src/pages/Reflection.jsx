import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Search, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import PageHeader, { Section } from '../components/ui/PageHeader'
import { AsyncView, EmptyState } from '../components/ui/States'
import { ConfirmModal } from '../components/ui/Modal'
import AiReflect from '../components/AiReflect'
import Mascot from '../components/ui/Mascot'
import { fmtDate, toISODate } from '../utils/date'

const PROMPTS = [
  { key: 'happy_moment', emoji: '🌼', q: 'What made you happy today?', ph: 'A moment, a person, a tiny joy…', tone: 'bg-cream-100' },
  { key: 'accomplishment', emoji: '🌟', q: 'What did you accomplish?', ph: 'Big or small, it all counts…', tone: 'bg-sage-50' },
  { key: 'improvement', emoji: '🌱', q: 'What can you improve tomorrow?', ph: 'One gentle step forward…', tone: 'bg-lavender-50' },
  { key: 'gratitude', emoji: '💗', q: 'What are you grateful for?', ph: 'People, things, small comforts…', tone: 'bg-blush-50' },
]
const EMPTY = { happy_moment: '', accomplishment: '', improvement: '', gratitude: '' }

function Writer({ day, setDay, onSaved, resetKey }) {
  const [form, setForm] = useState(EMPTY)
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let alive = true
    setLoading(true); setSaved(false)
    api.get('/reflections', { start: day, end: day, limit: 1 })
      .then((list) => {
        if (!alive) return
        const r = list[0] || null
        setExisting(r)
        setForm(r ? { ...EMPTY, ...Object.fromEntries(PROMPTS.map((p) => [p.key, r[p.key] || ''])) } : EMPTY)
      })
      .catch((e) => alive && toast.error(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [day, resetKey])

  const [save, busy] = useAction(async () => {
    const r = await api.put(`/reflections/${day}`, form)
    setExisting(r); setSaved(true); onSaved()
  })
  const filled = Object.values(form).some((v) => v.trim())

  return (
    <Section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Mascot size={48} mood="sleepy" /><div><h2 className="text-xl font-semibold">{day === toISODate() ? 'Tonight' : fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h2><p className="text-sm text-ink-2">Take a breath. There are no wrong answers.</p></div></div>
        <input type="date" className="input !w-auto" max={toISODate()} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Reflection date" />
      </div>
      {loading ? <p className="py-10 text-center text-sm text-ink-3">Opening your page…</p> : (
        <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
          {PROMPTS.map((p, i) => (
            <motion.div key={p.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className={`rounded-3xl p-4 ${p.tone}`}>
              <label className="block"><span className="mb-2 flex items-center gap-2 font-display text-lg font-semibold"><span aria-hidden>{p.emoji}</span>{p.q}</span>
                <textarea className="input min-h-[84px] !bg-surface/80" maxLength={4000} value={form[p.key]} onChange={(e) => { setSaved(false); setForm({ ...form, [p.key]: e.target.value }) }} placeholder={p.ph} /></label>
            </motion.div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AnimatePresence>{saved && <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-sm font-bold text-sage-600">🌙 Saved. Sleep well, you did enough today.</motion.p>}</AnimatePresence>
            <button className="btn-primary ml-auto" disabled={!filled || busy}>{existing ? 'Update reflection' : 'Save reflection'}</button>
          </div>
          {existing && <AiReflect key={existing.id + existing.updated_at} source="reflection" id={existing.id} existing={existing.ai_reflection} />}
        </form>
      )}
    </Section>
  )
}

export default function Reflection() {
  const [day, setDay] = useState(toISODate())
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [confirm, setConfirm] = useState(null)
  useEffect(() => { const t = setTimeout(() => setQuery(search), 300); return () => clearTimeout(t) }, [search])
  const history = useQuery(() => api.get('/reflections', { q: query, limit: 100 }), [query, version])
  const [remove, removing] = useAction(async () => { await api.del(`/reflections/${confirm.id}`); setConfirm(null); setResetKey((k) => k + 1); setVersion((v) => v + 1) }, { success: 'Reflection deleted' })

  return (
    <>
      <PageHeader emoji="🌙" title="Night Reflection" subtitle="End the day softly. Four little questions." />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3"><Writer resetKey={resetKey} day={day} setDay={setDay} onSaved={() => setVersion((v) => v + 1)} /></div>
        <div className="lg:col-span-2">
          <Section title="Past reflections" icon={<span aria-hidden>📖</span>}>
            <div className="relative mb-3"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" /><input className="input !pl-10" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search reflections" /></div>
            <AsyncView query={history} compact isEmpty={(d) => d.length === 0} empty={<EmptyState compact mood="sleepy" title={query ? 'Nothing matches' : 'No reflections yet'} hint={query ? 'Try another word.' : 'Tonight is a lovely time to write the first one.'} />}>
              {(list) => (
                <ul className="space-y-2">
                  {list.map((r) => {
                    const open = openId === r.id
                    return (
                      <li key={r.id} className="rounded-2xl bg-soft">
                        <button className="flex w-full items-center justify-between gap-2 p-3.5 text-left" aria-expanded={open} onClick={() => setOpenId(open ? null : r.id)}>
                          <span><span className="block text-sm font-bold">{fmtDate(r.entry_date, { weekday: 'long', day: 'numeric', month: 'short' })}</span><span className="line-clamp-1 text-xs text-ink-2">{r.happy_moment || r.gratitude || r.accomplishment || r.improvement}</span></span>
                          <ChevronDown size={16} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <div className="space-y-2.5 border-t border-line/60 p-3.5 text-sm">
                            {PROMPTS.filter((p) => r[p.key]).map((p) => <div key={p.key}><p className="text-xs font-bold text-ink-3">{p.emoji} {p.q}</p><p className="whitespace-pre-line text-ink-2">{r[p.key]}</p></div>)}
                            {r.ai_reflection && <p className="rounded-xl bg-lavender-50 p-2.5 text-xs leading-relaxed text-ink-2">✨ {r.ai_reflection}</p>}
                            <div className="flex justify-end gap-1">
                              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { setDay(r.entry_date); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button>
                              <button className="btn-ghost !px-3 !py-1.5 text-xs hover:!text-blush-600" onClick={() => setConfirm(r)}><Trash2 size={14} /> Delete</button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </AsyncView>
          </Section>
        </div>
      </div>
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={remove} busy={removing} title="Delete this reflection?" message={confirm ? `Your reflection for ${fmtDate(confirm.entry_date)} will be removed.` : ''} />
    </>
  )
}
