import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import PageHeader, { Section, Stat } from '../components/ui/PageHeader'
import { AsyncView, EmptyState } from '../components/ui/States'
import { Field, Segmented } from '../components/ui/Form'
import Modal, { ConfirmModal } from '../components/ui/Modal'
import MoodPicker from '../components/MoodPicker'
import AiReflect from '../components/AiReflect'
import { COLORS, tickProps, tooltipStyle } from '../utils/chart'
import { fmtDate, toISODate } from '../utils/date'

function CheckIn({ onSaved }) {
  const today = toISODate()
  const entries = useQuery(() => api.get('/mood', { start: today, end: today }), [])
  const entry = entries.data?.[0]
  const [mood, setMood] = useState(null)
  const [note, setNote] = useState('')
  useEffect(() => { if (entry) { setMood(entry.mood); setNote(entry.note || '') } }, [entry?.id, entry?.mood, entry?.note])
  const [save, busy] = useAction(async () => { await api.put('/mood', { mood, note }); await entries.reload(); onSaved() }, { success: 'Check-in saved 💗' })
  return (
    <Section title={entry ? "Today's check-in" : 'How are you feeling today?'} icon={<span aria-hidden>💭</span>}>
      <AsyncView query={entries} compact>
        {() => (
          <div className="space-y-4">
            <MoodPicker value={mood} onPick={setMood} />
            <Field label="Anything you want to say about it?">
              <textarea className="input min-h-[84px]" maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Just a few words is perfect…" />
            </Field>
            <div className="flex justify-end"><button className="btn-primary" disabled={!mood || busy} onClick={() => save()}>{entry ? 'Update check-in' : 'Save check-in'}</button></div>
            {entry && <AiReflect key={entry.id + (entry.note || '') + entry.mood} source="mood" id={entry.id} existing={entry.ai_reflection} onDone={entries.reload} />}
          </div>
        )}
      </AsyncView>
    </Section>
  )
}

function Trends({ version }) {
  const [days, setDays] = useState(30)
  const q = useQuery(() => api.get('/mood/trends', { days }), [days, version])
  return (
    <Section title="Mood trends" icon={<span aria-hidden>📈</span>} action={<Segmented size="sm" value={days} onChange={setDays} options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }]} />}>
      <AsyncView query={q} compact isEmpty={(d) => d.entries_count === 0} empty={<EmptyState compact title="No check-ins in this period" hint="Check in a few days and your mood story will appear." />}>
        {(t) => (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat tone="blush" icon={<span>💗</span>} label="Average" value={`${t.average_score}/5`} sub={`${t.entries_count} check-ins`} />
              <Stat tone="lavender" icon={<span>{t.distribution.find((d) => d.mood === t.most_common)?.emoji}</span>} label="Most often" value={t.distribution.find((d) => d.mood === t.most_common)?.label} />
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={t.series.map((s) => ({ ...s, label: fmtDate(s.date, { day: 'numeric', month: 'short' }) }))} margin={{ left: -24, right: 10, top: 10 }}>
                  <CartesianGrid vertical={false} stroke={COLORS.grid} />
                  <XAxis dataKey="label" tick={tickProps} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={tickProps} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v, _n, p) => [`${p.payload.emoji} ${p.payload.mood}`, `Score ${v}`]} />
                  <Line type="monotone" dataKey="score" stroke={COLORS.blush} strokeWidth={3} dot={{ r: 4, fill: COLORS.blush, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-wrap gap-2">
              {t.distribution.map((d) => <li key={d.mood} className="chip bg-soft text-ink-2">{d.emoji} {d.label} · {d.count}</li>)}
            </ul>
          </div>
        )}
      </AsyncView>
    </Section>
  )
}

function JournalForm({ open, onClose, entry, onSaved }) {
  const [f, setF] = useState({ title: '', content: '', entry_date: toISODate() })
  useEffect(() => { if (open) setF(entry ? { title: entry.title || '', content: entry.content || '', entry_date: entry.entry_date } : { title: '', content: '', entry_date: toISODate() }) }, [open, entry])
  const [save, busy] = useAction(
    async () => {
      const body = { title: f.title.trim() || null, content: f.content, entry_date: f.entry_date }
      if (entry) await api.patch(`/journal/${entry.id}`, body)
      else await api.post('/journal', body)
      onSaved(); onClose()
    },
    { success: entry ? 'Entry updated' : 'Entry saved 📓' },
  )
  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Edit entry' : 'Dear diary…'} wide>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field className="sm:col-span-2" label="Title (optional)"><input className="input" maxLength={160} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Date"><input className="input" type="date" max={toISODate()} value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} /></Field>
        </div>
        <Field label="What's on your mind?"><textarea className="input min-h-[200px] leading-relaxed" required autoFocus maxLength={20000} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Write freely. This space is only yours." /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.content.trim()}>Save entry</button></div>
      </form>
    </Modal>
  )
}

export default function Mood() {
  const [tab, setTab] = useState('mood')
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ open: false, entry: null })
  const [confirm, setConfirm] = useState(null)
  const refresh = () => setVersion((v) => v + 1)
  useEffect(() => { const t = setTimeout(() => setQuery(search), 300); return () => clearTimeout(t) }, [search])

  const history = useQuery(() => api.get('/mood', { start: toISODate(new Date(Date.now() - 59 * 864e5)), end: toISODate() }), [version])
  const journal = useQuery(() => api.get('/journal', { q: query, limit: 100 }), [query, version])
  const [remove, removing] = useAction(async () => { await api.del(`/journal/${confirm.id}`); setConfirm(null); refresh() }, { success: 'Entry deleted' })

  return (
    <>
      <PageHeader emoji="📓" title="Mood Journal" subtitle="A soft place to notice how you feel." actions={tab === 'journal' && <button className="btn-primary" onClick={() => setForm({ open: true, entry: null })}><Plus size={16} /> New entry</button>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'mood', label: '💭 Mood' }, { value: 'journal', label: '📓 Journal' }]} />

      {tab === 'mood' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <CheckIn onSaved={refresh} />
          <Trends version={version} />
          <Section title="Mood history" className="lg:col-span-2">
            <AsyncView query={history} compact isEmpty={(d) => d.length === 0} empty={<EmptyState compact title="Nothing here yet" hint="Your check-ins from the last two months will be listed here." />}>
              {(list) => (
                <ul className="grid gap-2.5 md:grid-cols-2">
                  {list.map((m) => (
                    <li key={m.id} className="rounded-2xl bg-soft p-3.5">
                      <div className="flex items-center gap-3"><span className="text-3xl">{m.emoji}</span><div><p className="text-sm font-bold">{m.label}</p><p className="text-xs text-ink-2">{fmtDate(m.entry_date)}</p></div></div>
                      {m.note && <p className="mt-2 text-sm text-ink-2">{m.note}</p>}
                      {m.ai_reflection && <p className="mt-2 rounded-xl bg-lavender-50 p-2.5 text-xs leading-relaxed text-ink-2">✨ {m.ai_reflection}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </AsyncView>
          </Section>
        </div>
      )}

      {tab === 'journal' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className="input !pl-10" placeholder="Search your entries…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search journal" />
          </div>
          <AsyncView query={journal} isEmpty={(d) => d.length === 0} empty={<EmptyState title={query ? 'No entries match that search' : 'Your journal is waiting'} hint={query ? 'Try a different word.' : 'Write about your day, your worries, or something that made you smile.'} action={!query && <button className="btn-primary" onClick={() => setForm({ open: true, entry: null })}>Write the first entry</button>} />}>
            {(list) => (
              <ul className="grid gap-4 lg:grid-cols-2">
                <AnimatePresence initial={false}>
                  {list.map((e) => (
                    <motion.li key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div><p className="font-display text-lg font-semibold">{e.title || 'Untitled'}</p><p className="text-xs font-bold text-ink-3">{fmtDate(e.entry_date, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
                        <div className="flex">
                          <button aria-label="Edit entry" className="rounded-full p-1.5 text-ink-3 hover:bg-soft" onClick={() => setForm({ open: true, entry: e })}><Pencil size={15} /></button>
                          <button aria-label="Delete entry" className="rounded-full p-1.5 text-ink-3 hover:bg-blush-100 hover:text-blush-600" onClick={() => setConfirm(e)}><Trash2 size={15} /></button>
                        </div>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{e.content}</p>
                      <AiReflect key={e.id + e.content} source="journal" id={e.id} existing={e.ai_reflection} onDone={journal.reload} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </AsyncView>
        </div>
      )}
      <JournalForm open={form.open} entry={form.entry} onClose={() => setForm({ open: false, entry: null })} onSaved={refresh} />
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={remove} busy={removing} title="Delete this entry?" message="This journal entry will be permanently removed." />
    </>
  )
}
