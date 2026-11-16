import { useCallback, useEffect, useRef, useState } from 'react'
import { toISODate } from '../utils/date'
import { playChime } from '../utils/chime'

const KEY = 'hlu-pomodoro'
const STALE_MS = 2 * 60_000 // finished while the app was closed for longer than this: don't credit it

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

/**
 * Pomodoro timer that survives page refreshes (it stores the end timestamp, not a countdown).
 * `onFocusComplete({ minutes, startedAt, topicId })` is called when a focus round finishes.
 */
export function usePomodoro(settings, onFocusComplete) {
  const minutesFor = useCallback(
    (mode) => ({ focus: settings.pomodoro_focus_minutes, short: settings.pomodoro_break_minutes, long: settings.pomodoro_long_break_minutes })[mode],
    [settings],
  )
  const msFor = useCallback((mode) => minutesFor(mode) * 60_000, [minutesFor])

  const [s, setS] = useState(() => {
    const saved = load()
    const today = toISODate()
    const base = { mode: 'focus', running: false, endsAt: null, remaining: msFor('focus'), topicId: null, startedAt: null, cycles: 0, cyclesDate: today }
    if (!saved) return base
    const merged = { ...base, ...saved, cycles: saved.cyclesDate === today ? saved.cycles : 0, cyclesDate: today }
    if (merged.running && merged.endsAt && Date.now() - merged.endsAt > STALE_MS) {
      return { ...merged, running: false, endsAt: null, startedAt: null, remaining: msFor(merged.mode) }
    }
    return merged
  })
  const [now, setNow] = useState(Date.now())
  const completing = useRef(false)
  const cb = useRef(onFocusComplete)
  cb.current = onFocusComplete

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [s])

  const remainingMs = s.running ? Math.max(0, s.endsAt - now) : s.remaining

  const sRef = useRef(s)
  sRef.current = s

  const complete = useCallback(() => {
    if (completing.current) return
    completing.current = true
    playChime()
    // Side effects happen here, once, outside the state updater (updaters can run twice in StrictMode).
    const cur = sRef.current
    const wasFocus = cur.mode === 'focus'
    const cycles = wasFocus ? cur.cycles + 1 : cur.cycles
    const next = wasFocus ? (cycles % 4 === 0 ? 'long' : 'short') : 'focus'
    if (wasFocus) cb.current?.({ minutes: minutesFor('focus'), startedAt: cur.startedAt, topicId: cur.topicId })
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(wasFocus ? 'Focus round complete 🌸' : 'Break is over ✨', { body: wasFocus ? 'Time for a gentle break.' : 'Ready for another round?', icon: '/favicon.svg' })
    }
    setS({ ...cur, mode: next, running: false, endsAt: null, startedAt: null, remaining: msFor(next), cycles })
    setTimeout(() => (completing.current = false), 500)
  }, [minutesFor, msFor])

  useEffect(() => {
    if (!s.running) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= s.endsAt) complete()
    }, 250)
    return () => clearInterval(id)
  }, [s.running, s.endsAt, complete])

  // Show the countdown in the browser tab.
  useEffect(() => {
    if (!s.running) return
    const secs = Math.ceil(remainingMs / 1000)
    document.title = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')} · Her Little Universe`
    return () => {
      document.title = 'Her Little Universe'
    }
  }, [s.running, remainingMs])

  const start = useCallback(() => {
    const t = Date.now()
    setNow(t)
    setS((cur) => ({ ...cur, running: true, endsAt: t + cur.remaining, startedAt: cur.startedAt ?? new Date().toISOString() }))
  }, [])
  const pause = useCallback(() => setS((cur) => (cur.running ? { ...cur, running: false, remaining: Math.max(0, cur.endsAt - Date.now()), endsAt: null } : cur)), [])
  const reset = useCallback(() => setS((cur) => ({ ...cur, running: false, endsAt: null, startedAt: null, remaining: msFor(cur.mode) })), [msFor])
  const setMode = useCallback((mode) => setS((cur) => ({ ...cur, mode, running: false, endsAt: null, startedAt: null, remaining: msFor(mode) })), [msFor])
  const setTopic = useCallback((topicId) => setS((cur) => ({ ...cur, topicId })), [])

  /** Stop a focus round early and return the whole minutes actually studied (or 0). */
  const finishEarly = useCallback(() => {
    const elapsed = Math.floor((msFor('focus') - remainingMs) / 60_000)
    const info = { minutes: elapsed, startedAt: s.startedAt, topicId: s.topicId }
    setS((cur) => ({ ...cur, running: false, endsAt: null, startedAt: null, remaining: msFor('focus'), mode: 'focus' }))
    return info
  }, [msFor, remainingMs, s.startedAt, s.topicId])

  const totalMs = msFor(s.mode)
  return { ...s, remainingMs, totalMs, progress: totalMs ? 1 - remainingMs / totalMs : 0, start, pause, reset, setMode, setTopic, finishEarly, minutesFor }
}
