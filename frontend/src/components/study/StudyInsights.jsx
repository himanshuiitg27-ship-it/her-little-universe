import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../api/client'
import { useQuery } from '../../hooks/useQuery'
import { useAction } from '../../hooks/useAction'
import { COLORS, PIE_COLORS, tickProps, tooltipStyle } from '../../utils/chart'
import { fmtDate, fmtMinutes } from '../../utils/date'
import { AsyncView, EmptyState } from '../ui/States'
import { Segmented } from '../ui/Form'
import { Section, Stat } from '../ui/PageHeader'
import { BookOpen, CalendarCheck, Clock3, Trash2 } from 'lucide-react'

export default function StudyInsights({ refreshKey, onChanged }) {
  const [period, setPeriod] = useState('week')
  const q = useQuery(() => api.get('/study/analytics', { period }), [period, refreshKey])
  const sessions = useQuery(() => api.get('/study/sessions', { start: q.data?.start, end: q.data?.end }), [q.data?.start, q.data?.end, refreshKey])
  const [del] = useAction((id) => api.del(`/study/sessions/${id}`).then(() => { sessions.reload(); q.reload(); onChanged?.() }), { success: 'Session removed' })

  return (
    <div className="space-y-5">
      <Segmented value={period} onChange={setPeriod} options={[{ value: 'day', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' }]} />
      <AsyncView query={q} compact>
        {(a) => {
          const days = a.days.map((d) => ({ label: period === 'month' ? String(+d.date.slice(8)) : fmtDate(d.date, { weekday: 'short' }), hours: +(d.minutes / 60).toFixed(2), minutes: d.minutes }))
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat tone="lavender" icon={<Clock3 size={22} />} label="Total" value={fmtMinutes(a.total_minutes)} sub={`${a.sessions_count} sessions`} />
                <Stat tone="blush" icon={<CalendarCheck size={22} />} label="Active days" value={a.active_days} sub={a.active_days ? `${fmtMinutes(a.average_minutes_per_active_day)} per day` : 'Start a session!'} />
                <Stat tone="sage" icon={<BookOpen size={22} />} label="Topics finished" value={a.topics_completed} />
                <Stat tone="cream" icon={<span>⭐</span>} label="Best day" value={a.best_day ? fmtDate(a.best_day, { weekday: 'short', day: 'numeric' }) : '–'} />
              </div>
              {a.total_minutes === 0 ? (
                <EmptyState compact title="No study time in this period yet" hint="Run a focus timer or log time and your charts will bloom here." />
              ) : (
                <div className="grid gap-5 lg:grid-cols-5">
                  <Section title={period === 'day' ? 'Today' : 'Study time per day'} className="lg:col-span-3">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={days} margin={{ left: -20, right: 4, top: 8 }}>
                          <CartesianGrid vertical={false} stroke={COLORS.grid} />
                          <XAxis dataKey="label" tick={tickProps} axisLine={false} tickLine={false} interval={period === 'month' ? 2 : 0} />
                          <YAxis tick={tickProps} axisLine={false} tickLine={false} unit="h" allowDecimals />
                          <Tooltip {...tooltipStyle} formatter={(_v, _n, p) => [fmtMinutes(p.payload.minutes), 'Studied']} />
                          {period !== 'day' && <ReferenceLine y={a.goal_minutes_per_day / 60} stroke={COLORS.sage} strokeDasharray="5 5" label={{ value: 'goal', fill: COLORS.sage, fontSize: 11, position: 'insideTopRight' }} />}
                          <Bar dataKey="hours" fill={COLORS.lavender} radius={[10, 10, 4, 4]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                  <Section title="By subject" className="lg:col-span-2">
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={a.by_subject} dataKey="minutes" nameKey="subject" innerRadius={42} outerRadius={70} paddingAngle={3} stroke="none">
                            {a.by_subject.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip {...tooltipStyle} formatter={(v) => fmtMinutes(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {a.by_subject.map((s, i) => (
                        <li key={s.subject} className="flex items-center justify-between">
                          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{s.subject}</span>
                          <span className="font-bold">{fmtMinutes(s.minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                </div>
              )}
            </>
          )
        }}
      </AsyncView>

      <Section title="Sessions">
        <AsyncView query={sessions} compact empty={<EmptyState compact title="No sessions yet" hint="Your focus rounds and logged time will appear here." />} isEmpty={(d) => d.length === 0}>
          {(list) => (
            <ul className="divide-y divide-line/70">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-lavender-100 text-lg">{s.kind === 'pomodoro' ? '🍅' : '✏️'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{s.topic_title || 'General study'}</p>
                    <p className="text-xs text-ink-2">{fmtDate(s.session_date)}{s.notes ? ` · ${s.notes}` : ''}</p>
                  </div>
                  <span className="text-sm font-bold">{fmtMinutes(s.duration_minutes)}</span>
                  <button onClick={() => del(s.id)} aria-label="Delete session" className="rounded-full p-1.5 text-ink-3 hover:bg-blush-100 hover:text-blush-600"><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </AsyncView>
      </Section>
    </div>
  )
}
