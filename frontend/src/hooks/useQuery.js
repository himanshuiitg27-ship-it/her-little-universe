import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Loads data and exposes loading / error / reload. Stale responses are ignored,
 * and a background reload keeps showing the old data (no flicker back to a spinner).
 */
export function useQuery(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const reqId = useRef(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++reqId.current
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fetcherRef.current()
      if (id === reqId.current) setState({ data, error: null, loading: false })
      return data
    } catch (error) {
      if (id === reqId.current) setState((s) => ({ data: silent ? s.data : null, error, loading: false }))
      return null
    }
  }, [])

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const reload = useCallback(() => run({ silent: true }), [run])
  const retry = useCallback(() => run(), [run])
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), [])
  return { ...state, reload, retry, setData }
}
