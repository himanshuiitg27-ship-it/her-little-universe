const pad = (n) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (never UTC, so "today" matches what she sees on her clock). */
export const toISODate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseISODate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function fmtMinutes(total) {
  if (total === null || total === undefined) return '–'
  const m = Math.round(total)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}

export const fmtDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  parseISODate(s).toLocaleDateString(undefined, opts)

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export const fmtClock = (hhmmss) => {
  if (!hhmmss) return ''
  const [h, m] = hhmmss.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** "2026-11-14" + "23:00" -> ISO string with the browser's UTC offset applied. */
export const localToISO = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}`).toISOString()

export const isoToLocalParts = (iso) => {
  const d = new Date(iso)
  return { date: toISODate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

export const relativeDay = (s) => {
  const diff = Math.round((parseISODate(s) - parseISODate(toISODate())) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return `In ${diff} days`
  if (diff < -1 && diff > -7) return `${-diff} days ago`
  return fmtDate(s)
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
