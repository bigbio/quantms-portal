// Tiny fetch wrapper shared by every view.
// One place for: base-URL join, query-string building, JSON parsing, timeouts,
// and turning a failed call into a thrown Error (so views show a retry state).

const DEFAULT_TIMEOUT_MS = 20000

// Custom error carrying the HTTP status (or 0 for network/timeout failures).
export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function buildQuery(params) {
  if (!params) return ''
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    usp.set(key, String(value))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

/**
 * GET JSON from `${base}${path}` with optional query `params`.
 * Throws ApiError on non-2xx, network error, or timeout.
 *
 * @param {string} base   backend base URL (from config.js)
 * @param {string} path   path beginning with '/'
 * @param {object} [params] query parameters (empty/null values are dropped)
 * @param {object} [opts]  { timeout, signal }
 */
export async function apiGet(base, path, params, opts = {}) {
  const url = `${base}${path}${buildQuery(params)}`
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  // Allow an external signal to also abort this request.
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let res
  try {
    res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    clearTimeout(timer)
    throw new ApiError(`Network error contacting ${url}`, 0)
  }
  clearTimeout(timer)

  if (!res.ok) {
    throw new ApiError(`Request to ${url} failed (${res.status})`, res.status)
  }

  try {
    return await res.json()
  } catch (e) {
    throw new ApiError(`Invalid JSON from ${url}`, res.status)
  }
}
