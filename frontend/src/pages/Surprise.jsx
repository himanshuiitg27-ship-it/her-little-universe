import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Gift, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import { useAiStatus } from '../hooks/useAiStatus'
import PageHeader, { Section } from '../components/ui/PageHeader'
import { AsyncView, EmptyState } from '../components/ui/States'
import { Chip, Field, Toggle } from '../components/ui/Form'
import Mascot from '../components/ui/Mascot'

const KINDS = { motivation: { label: 'Motivation', emoji: '🌟', tone: 'lavender' }, compliment: { label: 'Compliment', emoji: '💗', tone: 'blush' }, hug: { label: 'Hug', emoji: '🤗', tone: 'sage' }, special: { label: 'Special', emoji: '🎁', tone: 'cream' } }

function HugBurst({ burstKey }) {
  const hearts = ['💗', '💖', '💞', '🌸', '💕', '🤍', '✨', '💗']
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {hearts.map((h, i) => (
        <motion.span key={`${burstKey}-${i}`} className="absolute bottom-6 text-3xl" style={{ left: `${8 + i * 11}%` }} initial={{ opacity: 0, y: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 0], y: -220 - (i % 3) * 40, scale: 1, x: (i % 2 ? 1 : -1) * 20 }} transition={{ duration: 2.2, delay: i * 0.08 }}>{h}</motion.span>
      ))}
    </div>
  )
}

function CustomForm({ onAdded }) {
  const [f, setF] = useState({ kind: 'special', content: '', emoji: '' })
  const [add, busy] = useAction(async () => { await api.post('/surprises', { kind: f.kind, content: f.content, emoji: f.emoji.trim() || null }); setF({ ...f, content: '', emoji: '' }); onAdded() }, { success: 'Message added to your box 🎁' })
  return (
    <form onSubmit={(e) => { e.preventDefault(); add() }} className="grid gap-3 sm:grid-cols-6">
      <Field className="sm:col-span-2" label="Type"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}</select></Field>
      <Field className="sm:col-span-3" label="Your message"><input className="input" required maxLength={1000} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Something sweet to find on a rough day…" /></Field>
      <Field label="Emoji"><input className="input text-center" maxLength={16} value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} placeholder="💌" /></Field>
      <div className="sm:col-span-6 flex justify-end"><button className="btn-primary" disabled={busy || !f.content.trim()}><Plus size={16} /> Add message</button></div>
    </form>
  )
}

export default function Surprise() {
  const ai = useAiStatus()
  const [opened, setOpened] = useState(null)
  const [burst, setBurst] = useState(0)
  const [showBuiltIn, setShowBuiltIn] = useState(false)
  const daily = useQuery(() => api.get('/surprises/daily'), [])
  const all = useQuery(() => api.get('/surprises'), [])

  const [open, opening] = useAction(async (kind) => {
    const s = await api.get('/surprises/random', { kind })
    setOpened(null)
    await new Promise((r) => setTimeout(r, 120))
    setOpened(s)
    if (kind === 'hug' || s.kind === 'hug') setBurst((b) => b + 1)
    all.reload()
  })
  const [askAi, asking] = useAction(async () => {
    const r = await api.post('/ai/motivation', {})
    setOpened({ id: `ai-${Date.now()}`, kind: 'special', emoji: '✨', content: r.message, ai: true })
  })
  const [toggle] = useAction((s) => api.patch(`/surprises/${s.id}`, { is_active: !s.is_active }).then(() => { all.reload(); daily.reload() }))
  const [remove] = useAction((s) => api.del(`/surprises/${s.id}`).then(() => { all.reload(); daily.reload() }), { success: 'Message deleted' })

  const custom = all.data?.filter((s) => s.is_custom) || []
  const builtIn = all.data?.filter((s) => !s.is_custom) || []

  return (
    <>
      <PageHeader emoji="🎁" title="Surprise Box" subtitle="Little bursts of kindness, just for you." />
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-blush-100 via-lavender-100 to-cream-200 p-6 shadow-soft md:p-10">
          <HugBurst burstKey={burst} />
          <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
            <AnimatePresence mode="wait">
              {opened ? (
                <motion.div key={opened.id} initial={{ opacity: 0, scale: 0.7, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: 'spring', damping: 14 }} className="w-full">
                  <div className="text-6xl">{opened.emoji || KINDS[opened.kind]?.emoji}</div>
                  <p className="mt-4 font-display text-2xl font-semibold leading-snug md:text-3xl">{opened.content}</p>
                  <div className="mt-3 flex justify-center">{opened.ai ? <Chip tone="lavender">✨ Written just now</Chip> : <Chip tone={KINDS[opened.kind].tone}>{KINDS[opened.kind].label}</Chip>}</div>
                </motion.div>
              ) : (
                <motion.div key="closed" exit={{ opacity: 0, scale: 0.8 }} className="flex flex-col items-center">
                  <motion.button onClick={() => open()} disabled={opening} whileHover={{ scale: 1.06, rotate: [0, -4, 4, 0] }} whileTap={{ scale: 0.92 }} className="text-8xl drop-shadow-lg" aria-label="Open a surprise">🎁</motion.button>
                  <p className="mt-3 font-script text-3xl text-blush-600">tap to open</p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button className="btn-primary" disabled={opening} onClick={() => open()}><Gift size={16} /> {opened ? 'Another surprise' : 'Open a surprise'}</button>
              <button className="btn-soft" disabled={opening} onClick={() => open('hug')}>🤗 Send me a hug</button>
              <button className="btn-lavender" disabled={opening} onClick={() => open('compliment')}>💗 A compliment</button>
              <button className="btn-lavender" disabled={opening} onClick={() => open('motivation')}>🌟 Motivation</button>
              {ai?.enabled && <button className="btn-ghost" disabled={asking} onClick={() => askAi()}><Sparkles size={16} /> {asking ? 'Writing…' : 'Write one for me'}</button>}
            </div>
          </div>
        </div>

        <Section title="Today's surprise" icon={<span aria-hidden>🌅</span>}>
          <AsyncView query={daily} compact>
            {(s) => (
              <div className="flex items-center gap-4"><span className="text-4xl">{s.emoji || KINDS[s.kind].emoji}</span><div><p className="text-lg font-semibold">{s.content}</p><p className="mt-0.5 text-xs text-ink-3">A new one arrives every day</p></div></div>
            )}
          </AsyncView>
          {daily.error && <EmptyState compact title="Your box is empty" hint="Add a message below, or switch some built-in ones back on." />}
        </Section>

        <Section title="Your special messages" icon={<span aria-hidden>💌</span>}>
          <p className="mb-4 text-sm text-ink-2">Write notes to your future self, or ask someone who loves you to leave a few here. They'll appear as surprises.</p>
          <CustomForm onAdded={() => { all.reload(); daily.reload() }} />
          <div className="mt-5">
            <AsyncView query={all} compact isEmpty={() => custom.length === 0} empty={<p className="text-sm text-ink-3">No special messages yet.</p>}>
              {() => (
                <ul className="space-y-2">
                  {custom.map((s) => (
                    <li key={s.id} className={`flex items-center gap-3 rounded-2xl bg-soft p-3 ${s.is_active ? '' : 'opacity-60'}`}>
                      <span className="text-2xl">{s.emoji || KINDS[s.kind].emoji}</span>
                      <p className="min-w-0 flex-1 text-sm font-semibold">{s.content}</p>
                      <Chip tone={KINDS[s.kind].tone} className="hidden sm:inline-flex">{KINDS[s.kind].label}</Chip>
                      <Toggle checked={s.is_active} onChange={() => toggle(s)} label={`Toggle message`} />
                      <button aria-label="Delete message" className="rounded-full p-1.5 text-ink-3 hover:bg-blush-100 hover:text-blush-600" onClick={() => remove(s)}><Trash2 size={15} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncView>
          </div>
        </Section>

        <section className="card">
          <button className="flex w-full items-center justify-between text-left" onClick={() => setShowBuiltIn((s) => !s)} aria-expanded={showBuiltIn}>
            <span className="flex items-center gap-2 font-display text-lg font-semibold"><Mascot size={26} float={false} /> Built-in messages ({builtIn.filter((s) => s.is_active).length}/{builtIn.length} on)</span>
            <ChevronDown className={`transition ${showBuiltIn ? 'rotate-180' : ''}`} />
          </button>
          {showBuiltIn && (
            <ul className="mt-4 grid gap-2 md:grid-cols-2">
              {builtIn.map((s) => (
                <li key={s.id} className={`flex items-center gap-3 rounded-2xl bg-soft p-3 ${s.is_active ? '' : 'opacity-60'}`}>
                  <span className="text-xl">{s.emoji}</span><p className="min-w-0 flex-1 text-xs font-semibold">{s.content}</p>
                  <Toggle checked={s.is_active} onChange={() => toggle(s)} label="Toggle message" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
