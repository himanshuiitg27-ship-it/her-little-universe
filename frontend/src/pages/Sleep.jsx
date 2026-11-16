import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Moon, Pencil, Sunrise, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'
import { useAction } from '../hooks/useAction'
import { useSettings } from '../context/SettingsContext'
import PageHeader, { Section, Stat } from '../components/ui/PageHeader'
import { AsyncView, EmptyState } from '../components/ui/States'
import { Field, ProgressRing, Segmented } from '../components/ui/Form'
import Modal, { ConfirmModal } from '../components/ui/Modal'
import ReminderManager from '../components/ReminderManager'
import { COLORS, tickProps, tooltipStyle } from '../utils/chart'
import { addDays, fmtDate, fmtMinutes, fmtTime, isoToLocalParts, localToISO, parseISODate, toISODate } from '../utils/date'

const QUALITY = ['😫', '😕', '😐', '🙂', '😴']

/** Bedtime later than wake time means she went to bed the previous evening. */
function buildTimes(wakeDate, bed, wake) {
  const bedDate = bed > wake ? toISODate(addDays(parseISODate(wakeDate), -1)) : wakeDate
  return { bedtime: localToISO(bedDate, bed), wake_time: localToISO(wakeDate, wake) }
}
const durationPreview = (bed, wake) => {
  const [bh, bm] = bed.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  let m = wh * 60 + wm - (bh * 60 + bm)
  if (m <= 0) m += 1440
  return m
}

function SleepForm({ open, onClose, record, onSaved }) {
  const { settings } = useSettings()
  const defaults = () => ({ wakeDate: toISODate(), bed: settings.target_bedtime.slice(0, 5), wake: settings.target_wake_time.slice(0, 5), quality: null, notes: '' })
  const [f, setF] = useState(defaults)
  useEffect(() => {
    if (!open) return
    if (record) {
      const b = isoToLocalParts(record.bedtime), w = isoToLocalParts(record.wake_time)
      setF({ wakeDate: w.date, bed: b.time, wake: w.time, quality: record.quality, notes: record.notes || '' })
    } else setF(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record])
  const preview = durationPreview(f.bed, f.wake)
  const [save, busy] = useAction(
    async () => {
      const body = { ...buildTimes(f.wakeDate, f.bed, f.wake), quality: f.quality, notes: f.notes.trim() || null }
      if (record) await api.patch(`/sleep/${record.id}`, body)
      else await api.post('/sleep', body)
      onSaved()
      onClose()
    },
    { success: record ? 'Sleep updated 🌙' : 'Sleep logged 🌙' },
  )
  return (
    <Modal open={open} onClose={onClose} title={record ? 'Edit sleep' : 'Log your sleep'}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
        <Field label="Morning you woke up"><input className="input" type="date" required max={toISODate()} value={f.wakeDate} onChange={(e) => setF({ ...f, wakeDate: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Went to bed"><input className="input" type="time" required value={f.bed} onChange={(e) => setF({ ...f, bed: e.target.value })} /></Field>
          <Field label="Woke up"><input className="input" type="time" required value={f.wake} onChange={(e) => setF({ ...f, wake: e.target.value })} /></Field>
        </div>
        <div className="rounded-2xl bg-lavender-50 p-3 text-center">
          <p className="text-xs font-bold uppercase text-ink-3">You slept</p>
          <p className="font-display text-3xl font-semibold text-lavender-500">{fmtMinutes(preview)}</p>
        </div>
        <div>
          <span className="label">How rested do you feel?</span>
          <div className="flex gap-2">
            {QUALITY.map((e, i) => (
              <button type="button" key={i} aria-pressed={f.quality === i + 1} aria-label={`Quality ${i + 1} of 5`} onClick={() => setF({ ...f, quality: f.quality === i + 1 ? null : i + 1 })} className={`flex-1 rounded-2xl border-2 py-2 text-2xl transition ${f.quality === i + 1 ? 'border-lavender-300 bg-lavender-100' : 'border-transparent bg-soft'}`}>{e}</button>
            ))}
          </div>
        </div>
        <Field label="Notes (optional)"><input className="input" maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Vivid dreams, woke up once…" /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{record ? 'Save changes' : 'Log sleep'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Sleep() {
  const [period, setPeriod] = useState('week')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ open: false, record: null })
  const [confirm, setConfirm] = useState(null)
  const analytics = useQuery(() => api.get('/sleep/analytics', { period }), [period, version])
  const records = useQuery(() => api.get('/sleep'), [version])
  const refresh = () => setVersion((v) => v + 1)
  const [remove, removing] = useAction(async () => { await api.del(`/sleep/${confirm.id}`); setConfirm(null); refresh() }, { success: 'Sleep entry removed' })
  const chart = useMemo(() => (analytics.data?.days || []).map((d) => ({ label: period === 'month' ? String(+d.date.slice(8)) : fmtDate(d.date, { weekday: 'short' }), hours: d.minutes ? +(d.minutes / 60).toFixed(2) : 0, minutes: d.minutes, bed: d.bedtime, wake: d.wake_time })), [analytics.data, period])

  return (
    <>
      <PageHeader emoji="🌙" title="Sleep" subtitle="Rest is productive too. Let's notice your rhythm, gently." actions={<button className="btn-primary" onClick={() => setForm({ open: true, record: null })}><Moon size={16} /> Log sleep</button>} />
      <div className="space-y-5">
        <Segmented value={period} onChange={setPeriod} options={[{ value: 'week', label: 'This week' }, { value: 'month', label: 'This month' }]} />
        <AsyncView query={analytics} compact>
          {(a) => (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat tone="lavender" icon={<Moon size={22} />} label="Average sleep" value={a.average_minutes ? fmtMinutes(a.average_minutes) : '–'} sub={`Goal ${fmtMinutes(a.goal_minutes)}`} />
                <Stat tone="sage" icon={<span>✅</span>} label="Nights on goal" value={`${a.goal_met_nights}/${a.records_count}`} sub={a.records_count ? 'of nights logged' : 'No nights logged yet'} />
                <Stat tone="blush" icon={<Moon size={22} />} label="Usual bedtime" value={a.average_bedtime || '–'} sub={a.records_count < 3 ? 'Needs 3+ nights' : undefined} />
                <Stat tone="cream" icon={<Sunrise size={22} />} label="Usual wake-up" value={a.average_wake_time || '–'} />
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                <Section title="Sleep per night" className="lg:col-span-2">
                  {a.records_count === 0 ? (
                    <EmptyState compact mood="sleepy" title="No sleep logged in this period" hint="Log last night to see your chart." action={<button className="btn-primary" onClick={() => setForm({ open: true, record: null })}>Log last night</button>} />
                  ) : (
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chart} margin={{ left: -20, right: 4, top: 8 }}>
                          <CartesianGrid vertical={false} stroke={COLORS.grid} />
                          <XAxis dataKey="label" tick={tickProps} axisLine={false} tickLine={false} interval={period === 'month' ? 2 : 0} />
                          <YAxis tick={tickProps} axisLine={false} tickLine={false} unit="h" domain={[0, 12]} ticks={[0, 4, 8, 12]} />
                          <Tooltip {...tooltipStyle} formatter={(_v, _n, p) => [p.payload.minutes ? `${fmtMinutes(p.payload.minutes)} (${p.payload.bed}–${p.payload.wake})` : 'Not logged', 'Slept']} />
                          <ReferenceLine y={a.goal_minutes / 60} stroke={COLORS.sage} strokeDasharray="5 5" />
                          <Bar dataKey="hours" radius={[10, 10, 4, 4]}>
                            {chart.map((d, i) => <Cell key={i} fill={d.minutes >= a.goal_minutes ? COLORS.sage : COLORS.lavender} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Section>
                <Section title="Consistency">
                  {a.consistency_score === null ? (
                    <p className="py-6 text-center text-sm text-ink-2">Log at least 3 nights and I'll show how steady your bedtimes and wake-ups are. 🌙</p>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-2 text-center">
                      <ProgressRing value={a.consistency_score} size={120} tone="lavender"><span className="font-display text-3xl font-semibold">{a.consistency_score}</span><span className="text-[10px] font-bold uppercase text-ink-3">out of 100</span></ProgressRing>
                      <p className="font-display text-lg font-semibold">{a.consistency_label}</p>
                      <p className="text-xs text-ink-2">Based on how much your bedtime and wake-up time vary from night to night.</p>
                    </div>
                  )}
                </Section>
              </div>
            </>
          )}
        </AsyncView>

        <div className="grid gap-5 lg:grid-cols-5">
          <Section title="Recent nights" className="lg:col-span-3">
            <AsyncView query={records} compact isEmpty={(d) => d.length === 0} empty={<EmptyState compact mood="sleepy" title="No nights logged yet" hint="Your sleep history will live here." />}>
              {(list) => (
                <ul className="divide-y divide-line/70">
                  {list.slice(0, 14).map((r) => (
                    <li key={r.id} className="flex items-center gap-3 py-2.5">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-lavender-100 text-lg">{r.quality ? QUALITY[r.quality - 1] : '🌙'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{fmtDate(r.sleep_date)}</p>
                        <p className="text-xs text-ink-2">{fmtTime(r.bedtime)} → {fmtTime(r.wake_time)}{r.notes ? ` · ${r.notes}` : ''}</p>
                      </div>
                      <span className="text-sm font-bold">{fmtMinutes(r.duration_minutes)}</span>
                      <button aria-label="Edit" className="rounded-full p-1.5 text-ink-3 hover:bg-soft" onClick={() => setForm({ open: true, record: r })}><Pencil size={15} /></button>
                      <button aria-label="Delete" className="rounded-full p-1.5 text-ink-3 hover:bg-blush-100 hover:text-blush-600" onClick={() => setConfirm(r)}><Trash2 size={15} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncView>
          </Section>
          <div className="lg:col-span-2"><ReminderManager kind="sleep" title="Sleep reminders" /></div>
        </div>
      </div>
      <SleepForm open={form.open} record={form.record} onClose={() => setForm({ open: false, record: null })} onSaved={refresh} />
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={remove} busy={removing} title="Delete this night?" message={confirm ? `Your sleep entry for ${fmtDate(confirm.sleep_date)} will be removed.` : ''} />
    </>
  )
}
