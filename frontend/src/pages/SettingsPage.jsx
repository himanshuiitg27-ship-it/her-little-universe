import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { useAction } from '../hooks/useAction'
import { useAiStatus } from '../hooks/useAiStatus'
import PageHeader, { Section } from '../components/ui/PageHeader'
import { Chip, Field, Segmented, Toggle } from '../components/ui/Form'

const toForm = (s) => ({
  display_name: s.display_name,
  study_hours: s.daily_study_goal_minutes / 60,
  sleep_hours: s.sleep_goal_minutes / 60,
  target_bedtime: s.target_bedtime.slice(0, 5),
  target_wake_time: s.target_wake_time.slice(0, 5),
  pomodoro_focus_minutes: s.pomodoro_focus_minutes,
  pomodoro_break_minutes: s.pomodoro_break_minutes,
  pomodoro_long_break_minutes: s.pomodoro_long_break_minutes,
})

export default function SettingsPage() {
  const { settings, update } = useSettings()
  const ai = useAiStatus()
  const [f, setF] = useState(() => toForm(settings))
  useEffect(() => {
    setF(toForm(settings))
  }, [settings])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const [save, busy] = useAction(
    () => update({
      display_name: f.display_name,
      daily_study_goal_minutes: Math.round(Number(f.study_hours) * 60),
      sleep_goal_minutes: Math.round(Number(f.sleep_hours) * 60),
      target_bedtime: `${f.target_bedtime}:00`,
      target_wake_time: `${f.target_wake_time}:00`,
      pomodoro_focus_minutes: Number(f.pomodoro_focus_minutes),
      pomodoro_break_minutes: Number(f.pomodoro_break_minutes),
      pomodoro_long_break_minutes: Number(f.pomodoro_long_break_minutes),
    }),
    { success: 'Settings saved 🌸' },
  )
  const [setTheme] = useAction((theme) => update({ theme }))
  const [setAi] = useAction((v) => update({ ai_enabled: v }), { success: (_) => 'Saved' })

  return (
    <>
      <PageHeader emoji="⚙️" title="Settings" subtitle="Make this little universe yours." />
      <div className="grid gap-5 lg:grid-cols-2">
        <form className="space-y-5 lg:col-span-2" onSubmit={(e) => { e.preventDefault(); save() }}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="About you" icon={<span aria-hidden>🌸</span>}>
              <div className="space-y-4">
                <Field label="What should I call you?"><input className="input" maxLength={60} value={f.display_name} onChange={set('display_name')} placeholder="Your name" /></Field>
                <Field label="Daily study goal (hours)"><input className="input" type="number" min={0.25} max={24} step={0.25} required value={f.study_hours} onChange={set('study_hours')} /></Field>
              </div>
            </Section>
            <Section title="Sleep" icon={<span aria-hidden>🌙</span>}>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Sleep goal (hours)" className="col-span-2"><input className="input" type="number" min={2} max={16} step={0.25} required value={f.sleep_hours} onChange={set('sleep_hours')} /></Field>
                <Field label="Usual bedtime"><input className="input" type="time" required value={f.target_bedtime} onChange={set('target_bedtime')} /></Field>
                <Field label="Usual wake-up"><input className="input" type="time" required value={f.target_wake_time} onChange={set('target_wake_time')} /></Field>
              </div>
            </Section>
            <Section title="Pomodoro timer" icon={<span aria-hidden>🍅</span>} className="lg:col-span-2">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Focus (min)"><input className="input" type="number" min={5} max={120} required value={f.pomodoro_focus_minutes} onChange={set('pomodoro_focus_minutes')} /></Field>
                <Field label="Short break"><input className="input" type="number" min={1} max={60} required value={f.pomodoro_break_minutes} onChange={set('pomodoro_break_minutes')} /></Field>
                <Field label="Long break"><input className="input" type="number" min={1} max={90} required value={f.pomodoro_long_break_minutes} onChange={set('pomodoro_long_break_minutes')} /></Field>
              </div>
            </Section>
          </div>
          <div className="flex justify-end"><button className="btn-primary" disabled={busy}>Save settings</button></div>
        </form>

        <Section title="Appearance" icon={<span aria-hidden>🎨</span>}>
          <Segmented value={settings.theme} onChange={setTheme} options={[{ value: 'light', label: 'Light', icon: <Sun size={15} /> }, { value: 'dark', label: 'Dark', icon: <Moon size={15} /> }]} />
          <p className="mt-3 text-sm text-ink-2">Light is the cozy default. Dark is easier on the eyes at night.</p>
        </Section>

        <Section title="AI features" icon={<span aria-hidden>✨</span>}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold">Use AI companion features</p>
              <p className="text-xs text-ink-2">Study planner, study buddy, weekly summary, reflections.</p>
            </div>
            <Toggle checked={settings.ai_enabled} onChange={setAi} label="Toggle AI features" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {!ai ? null : ai.configured ? <Chip tone="sage">Groq connected · {ai.model}</Chip> : <Chip tone="blush">No API key on the server</Chip>}
            {ai && ai.reason && <span className="text-xs text-ink-2">{ai.reason}</span>}
          </div>
          <p className="mt-3 text-xs text-ink-3">Your Groq key is set in the backend's environment file and never reaches this browser.</p>
        </Section>
      </div>
    </>
  )
}
