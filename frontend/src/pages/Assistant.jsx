import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import { useAiStatus } from '../hooks/useAiStatus'
import { useLocalStorage } from '../hooks/useLocalStorage'
import PageHeader, { Section } from '../components/ui/PageHeader'
import { Chip, Segmented } from '../components/ui/Form'
import Mascot from '../components/ui/Mascot'
import { Loading } from '../components/ui/States'
import { fmtDate } from '../utils/date'

function Unavailable({ reason }) {
  return (
    <div className="card mx-auto max-w-xl text-center">
      <Mascot size={80} mood="sleepy" />
      <h2 className="mt-2 text-xl font-semibold">Your AI companion is resting</h2>
      <p className="mt-2 text-sm text-ink-2">{reason}</p>
      <ol className="mx-auto mt-4 max-w-sm list-inside list-decimal space-y-1 text-left text-sm text-ink-2">
        <li>Open <code className="rounded bg-soft px-1">backend/.env</code></li>
        <li>Set <code className="rounded bg-soft px-1">GROQ_API_KEY=your-key</code></li>
        <li>Restart the backend</li>
      </ol>
      <p className="mt-4 text-xs text-ink-3">The key stays on the server and is never sent to the browser. Everything else in the app works without it. You can also switch AI on or off in <Link className="font-bold text-lavender-500" to="/settings">Settings</Link>.</p>
    </div>
  )
}

function Chat() {
  const topics = useQuery(() => api.get('/study/topics', { status: 'pending' }), [])
  const [messages, setMessages] = useLocalStorage('hlu-chat', [])
  const [input, setInput] = useState('')
  const [topicId, setTopicId] = useState('')
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length])

  const [send, sending] = useAction(async (text) => {
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput('')
    try {
      const r = await api.post('/ai/assistant', { messages: next.slice(-12), topic_id: topicId || null })
      setMessages([...next, { role: 'assistant', content: r.reply }])
    } catch (e) {
      setMessages(messages) // roll back so she can retry
      setInput(text)
      throw e
    }
  })
  const suggestions = ['Explain this like I\'m new to it', 'Give me a real-life example', 'Quiz me with 3 questions', 'Summarise the key points']

  return (
    <div className="card flex h-[calc(100vh-15rem)] min-h-[26rem] flex-col !p-0 md:h-[34rem]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 p-4">
        <select className="input !w-auto max-w-[16rem]" value={topicId} onChange={(e) => setTopicId(e.target.value)} aria-label="Topic you're studying">
          <option value="">Any topic</option>
          {(topics.data || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        {messages.length > 0 && <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setMessages([])}><Trash2 size={14} /> Clear chat</button>}
      </div>
      <div className="scroll-soft flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Mascot size={72} />
            <p className="font-display text-lg font-semibold">What shall we figure out together?</p>
            <p className="max-w-xs text-sm text-ink-2">Ask me to explain anything you're studying, as simply or as deeply as you like.</p>
            <div className="flex flex-wrap justify-center gap-2">{suggestions.map((s) => <button key={s} className="chip bg-lavender-100 text-lavender-600 hover:bg-lavender-200" onClick={() => setInput(s)}>{s}</button>)}</div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-3xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'rounded-br-lg bg-blush-300 text-white dark:text-[#2a1d2e]' : 'rounded-bl-lg bg-soft'}`}>{m.content}</div>
          </motion.div>
        ))}
        {sending && <div className="flex justify-start"><div className="rounded-3xl rounded-bl-lg bg-soft px-4 py-3 text-sm text-ink-3">Thinking<span className="animate-pulse">…</span></div></div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (input.trim() && !sending) send(input.trim()) }} className="flex gap-2 border-t border-line/70 p-3">
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000} placeholder="Ask about anything you're studying…" aria-label="Your message" />
        <button className="btn-primary shrink-0" disabled={!input.trim() || sending} aria-label="Send"><Send size={18} /></button>
      </form>
    </div>
  )
}

function Weekly() {
  const [data, setData] = useState(null)
  const [run, busy] = useAction(async () => setData(await api.post('/ai/weekly-summary', {})))
  const s = data?.stats
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Section title="Your week in words" icon={<Sparkles size={18} className="text-lavender-500" />}>
        {!data ? (
          <div className="py-6 text-center">
            <p className="mb-4 text-sm text-ink-2">I'll read through your study time, goals, habits, sleep and mood from this week and write you a kind, honest recap.</p>
            <button className="btn-primary" onClick={() => run()} disabled={busy}><Sparkles size={16} /> {busy ? 'Writing your recap…' : 'Write my weekly summary'}</button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs font-bold text-ink-3">{fmtDate(data.week_start)} to {fmtDate(data.week_end)}</p>
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{data.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {s.study_hours > 0 && <Chip tone="lavender">📚 {s.study_hours}h studied</Chip>}
              {s.goals_total > 0 && <Chip tone="blush">🎯 {s.goals_completed}/{s.goals_total} goals</Chip>}
              <Chip tone="sage">🌱 {s.habit_completion_pct}% habits</Chip>
              {s.average_sleep_hours && <Chip tone="cream">🌙 {s.average_sleep_hours}h avg sleep</Chip>}
              {s.average_mood_out_of_5 && <Chip tone="blush">💭 mood {s.average_mood_out_of_5}/5</Chip>}
            </div>
            <div className="mt-4 flex justify-end"><button className="btn-ghost text-xs" onClick={() => run()} disabled={busy}>{busy ? 'Rewriting…' : 'Write it again'}</button></div>
          </>
        )}
      </Section>
      <p className="text-center text-xs text-ink-3">The numbers come from your own data; AI only helps put them into words.</p>
    </div>
  )
}

export default function Assistant() {
  const ai = useAiStatus()
  const [tab, setTab] = useState('chat')
  return (
    <>
      <PageHeader emoji="✨" title="AI Companion" subtitle="A study buddy, weekly reflections and gentle planning." />
      {!ai ? <Loading compact /> : !ai.enabled ? <Unavailable reason={ai.reason} /> : (
        <>
          <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'chat', label: '💬 Study buddy' }, { value: 'weekly', label: '📝 Weekly summary' }]} />
          {tab === 'chat' ? <Chat /> : <Weekly />}
          <p className="mt-4 text-center text-xs text-ink-3">Looking for the AI study planner? Find it on the <Link to="/study" className="font-bold text-lavender-500">Study</Link> page.</p>
        </>
      )}
    </>
  )
}
