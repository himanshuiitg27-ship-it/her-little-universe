import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import { toISODate } from '../utils/date'
import { useToast } from '../context/ToastContext'

/**
 * Fires reminders while the app is open: an in-app toast always, plus a browser notification
 * when permission was granted (Settings -> Reminders). Each reminder fires at most once per minute-slot per day.
 */
export function useReminderNotifier() {
  const toast = useToast()
  const reminders = useRef([])

  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .get('/reminders', { enabled_only: true })
        .then((r) => alive && (reminders.current = r))
        .catch(() => {})
    load()
    const refresh = setInterval(load, 60_000)
    window.addEventListener('hlu:reminders-changed', load)

    const check = () => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const weekday = (now.getDay() + 6) % 7 // Mon=0
      const today = toISODate(now)
      for (const r of reminders.current) {
        if (r.remind_time.slice(0, 5) !== hhmm) continue
        const due = r.remind_date ? r.remind_date === today : r.days_of_week.includes(weekday)
        if (!due) continue
        const key = `hlu-fired:${r.id}:${today}:${hhmm}`
        try {
          if (localStorage.getItem(key)) continue
          localStorage.setItem(key, '1')
        } catch {
          /* private mode: may repeat, acceptable */
        }
        toast.info(`⏰ ${r.title}${r.message ? ` - ${r.message}` : ''}`)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(r.title, { body: r.message || 'A gentle reminder from Her Little Universe', icon: '/favicon.svg' })
        }
      }
    }
    const tick = setInterval(check, 15_000)
    return () => {
      alive = false
      clearInterval(refresh)
      clearInterval(tick)
      window.removeEventListener('hlu:reminders-changed', load)
    }
  }, [toast])
}
