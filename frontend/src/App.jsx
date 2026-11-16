import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/layout/Shell'
import { ErrorState, Loading } from './components/ui/States'
import { useSettings } from './context/SettingsContext'
import Dashboard from './pages/Dashboard'
import Study from './pages/Study'
import Sleep from './pages/Sleep'
import Habits from './pages/Habits'
import Mood from './pages/Mood'
import Garden from './pages/Garden'
import Surprise from './pages/Surprise'
import Reflection from './pages/Reflection'
import Achievements from './pages/Achievements'
import CalendarPage from './pages/CalendarPage'
import Assistant from './pages/Assistant'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const { settings, loading, error, retry } = useSettings()
  // Everything depends on the backend, so show one friendly gate instead of many broken pages.
  if (loading && !settings) return <Loading />
  if (error && !settings) return <ErrorState error={error} onRetry={retry} />
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="study" element={<Study />} />
        <Route path="sleep" element={<Sleep />} />
        <Route path="habits" element={<Habits />} />
        <Route path="mood" element={<Mood />} />
        <Route path="garden" element={<Garden />} />
        <Route path="surprise" element={<Surprise />} />
        <Route path="reflection" element={<Reflection />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
