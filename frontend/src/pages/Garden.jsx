import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import PageHeader, { Section } from '../components/ui/PageHeader'
import { AsyncView } from '../components/ui/States'
import { ProgressBar, ProgressRing } from '../components/ui/Form'
import { relativeDay } from '../utils/date'

const SIZE = { flower: 40, plant: 44, creature: 32, decoration: 46 }

/** Deterministic, stable placement so the garden doesn't reshuffle between visits. */
function place(item) {
  const i = item.slot ?? 0
  const x = 6 + ((i * 0.618033) % 1) * 86
  const band = { decoration: [32, 14], creature: [8, 26], plant: [48, 30], flower: [56, 34] }[item.kind]
  const y = band[0] + (((i * 37) % 100) / 100) * band[1]
  return { x, y }
}

function Plant({ item }) {
  const { x, y } = place(item)
  const [pop, setPop] = useState(0)
  const floaty = item.kind === 'creature'
  return (
    <motion.button
      type="button"
      onClick={() => setPop((n) => n + 1)}
      aria-label={item.name}
      title={item.name}
      className="absolute -translate-x-1/2 select-none leading-none"
      style={{ left: `${x}%`, top: `${y}%`, fontSize: SIZE[item.kind], zIndex: Math.round(y) }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, y: floaty ? [0, -10, 0] : 0, x: floaty ? [0, 8, 0] : 0, rotate: floaty ? 0 : [-2, 2, -2] }}
      transition={{ scale: { type: 'spring', delay: 0.05 * (item.slot ?? 0) }, y: { repeat: Infinity, duration: 3 + (item.slot % 3) }, x: { repeat: Infinity, duration: 4 + (item.slot % 2) }, rotate: { repeat: Infinity, duration: 4 + (item.slot % 3), ease: 'easeInOut' } }}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.85 }}
    >
      <span key={pop} className="inline-block">{item.emoji}</span>
      {pop > 0 && (
        <motion.span key={`s${pop}`} className="pointer-events-none absolute left-1/2 top-0 text-base" initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -28 }} transition={{ duration: 0.9 }}>✨</motion.span>
      )}
    </motion.button>
  )
}

export default function Garden() {
  const q = useQuery(() => api.get('/garden'), [])
  return (
    <>
      <PageHeader emoji="🌷" title="Happiness Garden" subtitle="Every kind thing you do helps it grow. It never wilts, no matter what." />
      <AsyncView query={q}>
        {(g) => {
          const unlocked = g.items.filter((i) => i.unlocked)
          const locked = g.items.filter((i) => !i.unlocked)
          return (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="relative h-80 overflow-hidden rounded-4xl bg-gradient-to-b from-lavender-100 via-blush-50 to-sage-100 shadow-soft sm:h-96 lg:col-span-2" role="img" aria-label={`Your garden with ${unlocked.length} things growing`}>
                  <motion.span className="absolute right-8 top-6 text-5xl" animate={{ rotate: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 8 }} aria-hidden>☀️</motion.span>
                  <motion.span className="absolute left-10 top-8 text-4xl opacity-80" animate={{ x: [0, 24, 0] }} transition={{ repeat: Infinity, duration: 14 }} aria-hidden>☁️</motion.span>
                  <div className="absolute inset-x-0 bottom-0 h-[62%] rounded-t-[50%] bg-sage-200/80" aria-hidden />
                  <div className="absolute inset-x-[-10%] bottom-0 h-[48%] rounded-t-[60%] bg-sage-300/70" aria-hidden />
                  <div className="absolute inset-0">
                    {unlocked.map((item) => <Plant key={item.key} item={item} />)}
                  </div>
                  <p className="absolute bottom-3 left-4 font-script text-xl text-sage-600">{unlocked.length} of {g.total_count} discovered</p>
                </div>

                <div className="space-y-5">
                  <Section>
                    <div className="flex items-center gap-4">
                      <ProgressRing value={g.progress_pct} tone="sage" size={110}>
                        <span className="text-[10px] font-bold uppercase text-ink-3">Level</span>
                        <span className="font-display text-4xl font-semibold leading-none">{g.level}</span>
                      </ProgressRing>
                      <div>
                        <p className="font-display text-2xl font-semibold">{g.total_xp} XP</p>
                        <p className="text-sm text-ink-2">{g.xp_for_next_level - g.xp_into_level} XP until level {g.level + 1}</p>
                        <p className="mt-1 text-xs font-bold text-sage-600">+{g.xp_today} XP today</p>
                      </div>
                    </div>
                    {g.next_unlock && (
                      <div className="mt-4 rounded-2xl bg-soft p-3.5">
                        <p className="text-xs font-bold uppercase text-ink-3">Next to discover</p>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-3xl grayscale">{g.next_unlock.emoji}</span>
                          <div className="flex-1"><p className="text-sm font-bold">{g.next_unlock.name}</p><ProgressBar className="mt-1.5" tone="lavender" value={(g.total_xp / g.next_unlock.unlock_xp) * 100} label="Progress to next unlock" /><p className="mt-1 text-xs text-ink-2">{g.next_unlock.unlock_xp - g.total_xp} XP to go</p></div>
                        </div>
                      </div>
                    )}
                  </Section>
                  <Section title="Recently grown" icon={<span aria-hidden>🌱</span>}>
                    {g.recent_events.length === 0 ? (
                      <p className="text-sm text-ink-2">Complete a goal, habit, study session or reflection and your garden will start to grow.</p>
                    ) : (
                      <ul className="space-y-2">
                        {g.recent_events.slice(0, 6).map((e, i) => (
                          <li key={i} className="flex items-center justify-between text-sm"><span className="truncate font-semibold">{e.label}</span><span className="shrink-0 pl-2 text-xs text-ink-2"><b className="text-sage-600">+{e.xp}</b> · {relativeDay(e.event_date)}</span></li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </div>
              </div>

              <Section title="Your collection" icon={<span aria-hidden>🧺</span>}>
                <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-7">
                  {[...unlocked, ...locked].map((i) => (
                    <li key={i.key} className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-center ${i.unlocked ? 'bg-sage-50' : 'bg-soft'}`} title={i.unlocked ? i.name : `Unlocks at ${i.unlock_xp} XP`}>
                      <span className={`text-3xl ${i.unlocked ? '' : 'opacity-30 grayscale'}`}>{i.unlocked ? i.emoji : i.emoji}</span>
                      <span className="text-[11px] font-bold leading-tight">{i.unlocked ? i.name : '???'}</span>
                      {!i.unlocked && <span className="flex items-center gap-1 text-[10px] text-ink-3"><Lock size={10} /> {i.unlock_xp} XP</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )
        }}
      </AsyncView>
    </>
  )
}
