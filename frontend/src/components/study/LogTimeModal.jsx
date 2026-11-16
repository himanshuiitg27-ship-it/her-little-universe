import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useAction } from '../../hooks/useAction'
import { toISODate } from '../../utils/date'
import Modal from '../ui/Modal'
import { Field } from '../ui/Form'

export default function LogTimeModal({ open, onClose, topics, defaultTopicId, onSaved }) {
  const [f, setF] = useState({ minutes: 30, topic_id: '', date: toISODate(), notes: '' })
  useEffect(() => {
    if (open) setF({ minutes: 30, topic_id: defaultTopicId || '', date: toISODate(), notes: '' })
  }, [open, defaultTopicId])
  const [save, busy] = useAction(
    async () => {
      await api.post('/study/sessions', { duration_minutes: Number(f.minutes), topic_id: f.topic_id || null, session_date: f.date, kind: 'manual', notes: f.notes.trim() || null })
      onSaved?.()
      onClose()
    },
    { success: 'Study time logged ✨' },
  )
  return (
    <Modal open={open} onClose={onClose} title="Log study time">
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutes"><input className="input" type="number" min={1} max={720} required value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></Field>
          <Field label="Date"><input className="input" type="date" max={toISODate()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="Topic">
          <select className="input" value={f.topic_id} onChange={(e) => setF({ ...f, topic_id: e.target.value })}>
            <option value="">General study</option>
            {topics.filter((t) => !t.is_completed).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        <Field label="Note (optional)"><input className="input" value={f.notes} maxLength={2000} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>Save time</button>
        </div>
      </form>
    </Modal>
  )
}
