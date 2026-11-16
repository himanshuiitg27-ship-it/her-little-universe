import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useAction } from '../../hooks/useAction'
import Modal from '../ui/Modal'
import { Field, Segmented } from '../ui/Form'

const EMPTY = { title: '', subject: '', priority: 'medium', deadline: '', planned_date: '', estimated_minutes: 60, notes: '' }

export default function TopicForm({ open, onClose, topic, subjects = [], onSaved }) {
  const [f, setF] = useState(EMPTY)
  useEffect(() => {
    if (open) setF(topic ? { ...EMPTY, ...topic, subject: topic.subject || '', deadline: topic.deadline || '', planned_date: topic.planned_date || '', notes: topic.notes || '' } : EMPTY)
  }, [open, topic])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const [save, busy] = useAction(
    async () => {
      const body = {
        title: f.title,
        subject: f.subject.trim() || null,
        priority: f.priority,
        deadline: f.deadline || null,
        planned_date: f.planned_date || null,
        estimated_minutes: Number(f.estimated_minutes),
        notes: f.notes.trim() || null,
      }
      if (topic) await api.patch(`/study/topics/${topic.id}`, body)
      else await api.post('/study/topics', body)
      onSaved?.()
      onClose()
    },
    { success: topic ? 'Topic updated' : 'Topic added 📚' },
  )

  return (
    <Modal open={open} onClose={onClose} title={topic ? 'Edit topic' : 'New study topic'}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
        <Field label="What are you studying?">
          <input className="input" required autoFocus value={f.title} onChange={set('title')} maxLength={200} placeholder="e.g. Organic chemistry: reaction mechanisms" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject">
            <input className="input" list="subjects" value={f.subject} onChange={set('subject')} maxLength={80} placeholder="Chemistry" />
            <datalist id="subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Estimated minutes">
            <input className="input" type="number" min={5} max={1440} step={5} required value={f.estimated_minutes} onChange={set('estimated_minutes')} />
          </Field>
        </div>
        <Field label="Priority">
          <Segmented value={f.priority} onChange={(v) => setF((x) => ({ ...x, priority: v }))} options={[{ value: 'low', label: '🌿 Low' }, { value: 'medium', label: '🌷 Medium' }, { value: 'high', label: '🔥 High' }]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline"><input className="input" type="date" value={f.deadline} onChange={set('deadline')} /></Field>
          <Field label="Plan for"><input className="input" type="date" value={f.planned_date} onChange={set('planned_date')} /></Field>
        </div>
        <Field label="Notes"><textarea className="input min-h-[70px]" value={f.notes} onChange={set('notes')} maxLength={4000} placeholder="Anything to remember…" /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !f.title.trim()}>{topic ? 'Save changes' : 'Add topic'}</button>
        </div>
      </form>
    </Modal>
  )
}
