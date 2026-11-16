import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { api } from '../api/client'
import { useQuery } from '../hooks/useQuery'

const SettingsContext = createContext(null)
export const useSettings = () => useContext(SettingsContext)

export function SettingsProvider({ children }) {
  const q = useQuery(() => api.get('/settings'), [])
  const theme = q.data?.theme

  useEffect(() => {
    if (!theme) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('hlu-theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const update = useCallback(
    async (patch) => {
      const saved = await api.patch('/settings', patch)
      q.setData(saved)
      window.dispatchEvent(new Event('hlu:settings-changed'))
      return saved
    },
    [q],
  )

  const value = useMemo(() => ({ settings: q.data, loading: q.loading, error: q.error, retry: q.retry, update }), [q.data, q.loading, q.error, q.retry, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
