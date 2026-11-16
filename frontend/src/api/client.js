// All data comes from the FastAPI backend. The browser never sees any API key
// (the Groq key lives only in the backend environment).
const BASE = import.meta.env.VITE_API_URL || '/api'

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function emitRewards(data) {
  const rewards = data?.rewards ?? data?.habit?.rewards
  if (rewards && (rewards.xp_gained || rewards.new_items?.length || rewards.new_achievements?.length)) {
    window.dispatchEvent(new CustomEvent('hlu:rewards', { detail: rewards }))
  }
}

async function request(method, path, { params, body } = {}) {
  const url = new URL(BASE + path, window.location.origin)
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  let res
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0, 'network')
  }
  if (res.status === 204) return null
  let data = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(e?.message || `Something went wrong (${res.status})`, res.status, e?.code)
  }
  if (method !== 'GET') emitRewards(data)
  return data
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body, params) => request('POST', path, { body: body ?? {}, params }),
  put: (path, body) => request('PUT', path, { body: body ?? {} }),
  patch: (path, body) => request('PATCH', path, { body: body ?? {} }),
  del: (path) => request('DELETE', path),
}
