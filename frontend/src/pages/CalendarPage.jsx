import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import PageHeader, { Section } from '../components/ui/PageHeader'
import { AsyncView, EmptyState } from '../components/ui/States'
import { Chip, Field } from '../components/ui/Form'
import Modal, { ConfirmModal } from '../components/ui/Modal'
import ReminderManager from '../components/ReminderManager'
import { addDays, fmtClock, fmtDate, parseISODate, relativeDay, toISODate, WEEKDAYS } from '../utils/date'

const TYPES = { exam: { label: '📝 Exam', dot: 'bg-blush-400', tone: 'blush' }, deadline: { label: '⏰ Deadline', dot: 'bg-blush-300', tone: 'blush' }, study: { label: '📚 Study', dot: 'bg-lavender-400', tone: 'lavender' }, goal: { label: '🎯 Personal goal', dot: 'bg-sage-400', tone: 'sage' }, personal: { label: '💗 Personal', dot: 'bg-sage-300', tone: 'sage' }, other: { label: '✨ Other', dot: 'bg-ink-3', tone: 'neutral' } }
const EVENT_TYPES = ['exam', 'deadline', 'study', 'goal', 'personal', 'other']

function EventForm({ open, onClose, event, defaultDate, onSaved }) {
  const blank = { title: '', event_type: 'exam', event_date: defaultDate, start_time: '', end_time: '', description: '' }
  const [f, setF] = useState(blank)
  useEffect(() => {
    if (open) setF(event ? { ...blank, ...event, start_time: event.start_time?.slice(0, 5) || '', end_time: event.end_time?.slice(0, 5) || '', description: event.description || '' } : { ...blank, event_date: defaultDate })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, defaultDate])
  const [save, busy] = useAction(
    async () => {
      const body = { title: f.title, event_type: f.event_type, event_date: f.event_date, start_time: f.start_time ? `${f.start_time}:00` : null, end_time: f.end_time ? `${f.end_time}:00` : null, description: f.description.trim() || null }
      if (event) await api.patch(`/calendar/events/${event.id}`, body)
      else await api.post('/calendar/events', body)
      onSaved(); onClose()
    },
    { success: event ? 'Event updated' : 'Event added 📅' },
  )
  return (
    <Modal open={open} onClose={onClose} title={event ? 'Edit event' : 'New event'}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
        <Field label="Title"><input className="input" required autoFocus maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Physics midterm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><select className="input" value={f.event_type} onChange={(e) => setF({ ...f, event_type: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}</select></Field>
          <Field label="Date"><input className="input" type="date" required value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></Field>
          <Field label="Starts (optional)"><input className="input" type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></Field>
          <Field label="Ends (optional)"><input className="input" type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><textarea className="input min-h-[64px]" maxLength={4000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.title.trim()}>{event ? 'Save' : 'Add event'}</button></div>
      </form>
    </Modal>
  )
}

function ItemRow({ it, onEdit, onDelete, onToggle }) {
  const t = TYPES[it.item_type] || TYPES.other
  return (
    <li className={`flex items-center gap-3 rounded-2xl bg-soft p-3 ${it.is_completed ? 'opacity-60' : ''}`}>
      {it.source === 'event' ? (
        <input type="checkbox" className="h-4 w-4 accent-sage-400" checked={it.is_completed} onChange={() => onToggle(it)} aria-label={`Mark ${it.title} done`} />
      ) : <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${it.is_completed ? 'line-through' : ''}`}>{it.title}</p>
        <p className="text-xs text-ink-2">{relativeDay(it.date)}{it.start_time ? ` · ${fmtClock(it.start_time)}` : ''}</p>
      </div>
      <Chip tone={t.tone}>{t.label.split(' ')[0]}</Chip>
      {it.editable && (<><button aria-label={`Edit ${it.title}`} className="rounded-full p-1.5 text-ink-3 hover:bg-surface" onClick={() => onEdit(it)}><Pencil size={14} /></button><button aria-label={`Delete ${it.title}`} className="rounded-full p-1.5 text-ink-3 hover:bg-blush-100 hover:text-blush-600" onClick={() => onDelete(it)}><Trash2 size={14} /></button></>)}
    </li>
  )
}

export default function CalendarPage() {
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [selected, setSelected] = useState(toISODate())
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ open: false, event: null })
  const [confirm, setConfirm] = useState(null)
  const month = useQuery(() => api.get('/calendar/month', { year: cursor.y, month: cursor.m }), [cursor.y, cursor.m, version])
  const upcoming = useQuery(() => api.get('/calendar/upcoming', { days: 45 }), [version])
  const refresh = () => setVersion((v) => v + 1)
  const [toggle] = useAction((it) => api.patch(`/calendar/events/${it.id}`, { is_completed: !it.is_completed }).then(refresh))
  const [remove, removing] = useAction(async () => { await api.del(`/calendar/events/${confirm.id}`); setConfirm(null); refresh() }, { success: 'Event deleted' })

  const edit = (it) => setForm({ open: true, event: { id: it.id, title: it.title, event_type: it.item_type, event_date: it.date, start_time: it.start_time, end_time: it.end_time, description: it.description } })

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m - 1, 1)
    const start = addDays(first, -((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i)).filter((d, i) => i < 35 || d.getMonth() === cursor.m - 1)
  }, [cursor])
  const byDay = useMemo(() => {
    const map = {}
    ;(month.data?.items || []).forEach((i) => (map[i.date] ||= []).push(i))
    return map
  }, [month.data])
  const shift = (n) => setCursor(({ y, m }) => { const d = new Date(y, m - 1 + n, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 } })
  const title = new Date(cursor.y, cursor.m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const today = toISODate()
  const selectedItems = byDay[selected] || []

  return (
    <>
      <PageHeader emoji="🗓️" title="Calendar" subtitle="Exams, deadlines, study plans and the things that matter to you." actions={<button className="btn-primary" onClick={() => setForm({ open: true, event: null })}><Plus size={16} /> New event</button>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{title}</h2>
            <div className="flex items-center gap-1">
              <button className="btn-ghost !p-2" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <button className="btn-soft !px-3 !py-1.5 text-xs" onClick={() => { setCursor({ y: now.getFullYear(), m: now.getMonth() + 1 }); setSelected(today) }}>Today</button>
              <button className="btn-ghost !p-2" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-bold uppercase text-ink-3">{WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
          {month.error && !month.data ? <p className="py-10 text-center text-sm text-ink-2">{month.error.message}</p> : (
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d) => {
                const iso = toISODate(d)
                const inMonth = d.getMonth() === cursor.m - 1
                const items = byDay[iso] || []
                const active = iso === selected
                return (
                  <button key={iso} onClick={() => setSelected(iso)} aria-label={`${fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}, ${items.length} items`} aria-pressed={active} className={`flex aspect-square flex-col items-center justify-start gap-1 rounded-2xl p-1.5 text-sm font-bold transition sm:aspect-[5/4] ${active ? 'bg-blush-200 text-blush-600' : inMonth ? 'bg-soft hover:bg-lavender-100' : 'opacity-35 hover:opacity-60'} ${iso === today ? 'ring-2 ring-blush-300' : ''}`}>
                    <span>{d.getDate()}</span>
                    <span className="flex flex-wrap justify-center gap-0.5">{items.slice(0, 4).map((it) => <span key={it.id} className={`h-1.5 w-1.5 rounded-full ${(TYPES[it.item_type] || TYPES.other).dot}`} />)}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-ink-2">{Object.entries(TYPES).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${v.dot}`} />{v.label.split(' ').slice(1).join(' ')}</span>)}</div>
        </section>

        <div className="space-y-5">
          <Section title={fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })} action={<button className="btn-soft !px-3 !py-1.5 text-xs" onClick={() => setForm({ open: true, event: null })}><Plus size={14} /> Add</button>}>
            {selectedItems.length === 0 ? <EmptyState compact title="A free day" hint="Nothing scheduled. Add an event if you like." /> : <ul className="space-y-2">{selectedItems.map((it) => <ItemRow key={it.id} it={it} onEdit={edit} onDelete={setConfirm} onToggle={toggle} />)}</ul>}
          </Section>
          <Section title="Coming up" icon={<span aria-hidden>⏳</span>}>
            <AsyncView query={upcoming} compact isEmpty={(d) => d.length === 0} empty={<EmptyState compact title="All clear for the next 6 weeks" hint="Exams and deadlines you add will show here." />}>
              {(list) => <ul className="space-y-2">{list.slice(0, 8).map((it) => <ItemRow key={it.id} it={it} onEdit={edit} onDelete={setConfirm} onToggle={toggle} />)}</ul>}
            </AsyncView>
          </Section>
        </div>
      </div>
      <div className="mt-5"><ReminderManager title="Reminders" /></div>

      <EventForm open={form.open} event={form.event} defaultDate={selected} onClose={() => setForm({ open: false, event: null })} onSaved={refresh} />
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={remove} busy={removing} title="Delete this event?" message={`"${confirm?.title}" will be removed from your calendar.`} />
    </>
  )
}
