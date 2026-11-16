import { useEffect, useState } from 'react'
import { Bell, BellOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import { useToast } from '../context/ToastContext'
import { fmtClock, WEEKDAYS } from '../utils/date'
import { AsyncView, EmptyState } from './ui/States'
import Modal from './ui/Modal'
import { Chip, Field, Toggle } from './ui/Form'
import { Section } from './ui/PageHeader'

const KINDS = { sleep: '🌙 Sleep', study: '📚 Study', habit: '🌱 Habit', event: '📅 Event', custom: '💗 Custom' }
const changed = () => window.dispatchEvent(new Event('hlu:reminders-changed'))

function ReminderForm({ open, onClose, reminder, fixedKind, onSaved }) {
  const blank = { title: '', message: '', kind: fixedKind || 'custom', remind_time: '09:00', days_of_week: [0, 1, 2, 3, 4, 5, 6], remind_date: '' }
  const [f, setF] = useState(blank)
  useEffect(() => {
    if (!open) return
    setF(reminder ? { ...reminder, message: reminder.message || '', remind_time: reminder.remind_time.slice(0, 5), remind_date: reminder.remind_date || '' } : blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reminder])
  const toggleDay = (d) => setF((x) => ({ ...x, days_of_week: x.days_of_week.includes(d) ? x.days_of_week.filter((i) => i !== d) : [...x.days_of_week, d].sort() }))
  const [save, busy] = useAction(
    async () => {
      const body = { title: f.title, message: f.message.trim() || null, kind: f.kind, remind_time: `${f.remind_time}:00`, days_of_week: f.remind_date ? [] : f.days_of_week, remind_date: f.remind_date || null }
      if (reminder) await api.patch(`/reminders/${reminder.id}`, body)
      else await api.post('/reminders', body)
      changed()
      onSaved()
      onClose()
    },
    { success: 'Reminder saved ⏰' },
  )
  return (
    <Modal open={open} onClose={onClose} title={reminder ? 'Edit reminder' : 'New reminder'}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
        <Field label="Title"><input className="input" required autoFocus maxLength={160} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Wind down for bed" /></Field>
        <Field label="Message (optional)"><input className="input" maxLength={1000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Put the phone away 🌙" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time"><input className="input" type="time" required value={f.remind_time} onChange={(e) => setF({ ...f, remind_time: e.target.value })} /></Field>
          {!fixedKind && (
            <Field label="Type">
              <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div>
          <span className="label">Repeats on</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <button type="button" key={d} disabled={!!f.remind_date} aria-pressed={f.days_of_week.includes(i)} onClick={() => toggleDay(i)} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${f.days_of_week.includes(i) && !f.remind_date ? 'bg-blush-300 text-white' : 'bg-soft text-ink-2'}`}>{d}</button>
            ))}
          </div>
        </div>
        <Field label="…or just once on a date" hint="Choosing a date makes this a one-time reminder.">
          <input className="input" type="date" value={f.remind_date} onChange={(e) => setF({ ...f, remind_date: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !f.title.trim() || (!f.remind_date && f.days_of_week.length === 0)}>Save reminder</button>
        </div>
      </form>
    </Modal>
  )
}

export default function ReminderManager({ kind, title = 'Reminders' }) {
  const toast = useToast()
  const q = useQuery(() => api.get('/reminders'), [])
  const [form, setForm] = useState({ open: false, reminder: null })
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [toggle] = useAction((r) => api.patch(`/reminders/${r.id}`, { is_enabled: !r.is_enabled }).then(() => { changed(); q.reload() }))
  const [remove] = useAction((r) => api.del(`/reminders/${r.id}`).then(() => { changed(); q.reload() }), { success: 'Reminder removed' })

  const askPermission = async () => {
    const result = await Notification.requestPermission()
    setPerm(result)
    result === 'granted' ? toast.success('Browser notifications are on 🔔') : toast.info('No problem, you will still see reminders inside the app while it is open.')
  }
  const describe = (r) => (r.remind_date ? `Once on ${r.remind_date}` : r.days_of_week.length === 7 ? 'Every day' : r.days_of_week.map((d) => WEEKDAYS[d]).join(', '))
  const list = (q.data || []).filter((r) => !kind || r.kind === kind)

  return (
    <Section title={title} icon={<Bell size={18} className="text-lavender-500" />} action={<button className="btn-soft !px-3 !py-1.5 text-xs" onClick={() => setForm({ open: true, reminder: null })}><Plus size={14} /> Add</button>}>
      <AsyncView query={q} compact isEmpty={() => list.length === 0} empty={<EmptyState compact title="No reminders yet" hint="Add one and I'll nudge you gently while the app is open." />}>
        {() => (
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id} className={`flex items-center gap-3 rounded-2xl bg-soft p-3 ${r.is_enabled ? '' : 'opacity-60'}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{r.title}</p>
                  <p className="text-xs text-ink-2">{fmtClock(r.remind_time)} · {describe(r)}</p>
                </div>
                {!kind && <Chip tone="lavender">{KINDS[r.kind]}</Chip>}
                <Toggle checked={r.is_enabled} onChange={() => toggle(r)} label={`${r.is_enabled ? 'Turn off' : 'Turn on'} ${r.title}`} />
                <button aria-label={`Edit ${r.title}`} className="rounded-full p-1.5 text-ink-3 hover:bg-surface" onClick={() => setForm({ open: true, reminder: r })}><Pencil size={15} /></button>
                <button aria-label={`Delete ${r.title}`} className="rounded-full p-1.5 text-ink-3 hover:bg-blush-100 hover:text-blush-600" onClick={() => remove(r)}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
      {perm === 'default' && (
        <button className="btn-ghost mt-3 !px-2 text-xs" onClick={askPermission}><Bell size={14} /> Also notify me outside this tab</button>
      )}
      {perm === 'denied' && <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3"><BellOff size={13} /> Browser notifications are blocked. Reminders still appear in the app.</p>}
      <ReminderForm open={form.open} reminder={form.reminder} fixedKind={kind} onClose={() => setForm({ open: false, reminder: null })} onSaved={q.reload} />
    </Section>
  )
}
