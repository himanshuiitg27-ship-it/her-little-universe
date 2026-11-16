import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../../api/client'
import { useAction } from '../../hooks/useAction'

export default function AddGoalForm({ goalDate, onAdded, placeholder = 'Add a goal for today…' }) {
  const [title, setTitle] = useState('')
  const [add, busy] = useAction(async () => {
    await api.post('/goals', { title, goal_date: goalDate })
    setTitle('')
    onAdded?.()
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim()) add()
      }}
      className="flex gap-2"
    >
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} maxLength={200} aria-label="New goal" />
      <button className="btn-primary shrink-0" disabled={busy || !title.trim()} aria-label="Add goal">
        <Plus size={18} />
        <span className="hidden sm:inline">Add</span>
      </button>
    </form>
  )
}
