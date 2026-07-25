import { apiGet } from './api.js'
import { DE_BASE } from './config.js'
export const listDatasets = () => apiGet(DE_BASE, '/de/datasets')
export const getDesign = (ref) => apiGet(DE_BASE, `/de/${ref}/design`)
export const getDefault = (ref, contrast) => apiGet(DE_BASE, `/de/${ref}/default`, { contrast })
export const getQc = (ref) => apiGet(DE_BASE, `/de/${ref}/qc`)

// On-demand runs can take much longer than a plain GET, but they still need a
// ceiling — mirrors apiGet's timeout convention (an aborted/timed-out request
// throws with `.status = 0`, same as apiGet's network/timeout errors).
const DEFAULT_RUN_TIMEOUT_MS = 20000

export async function runDe(ref, cfg, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_RUN_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    let res
    try {
      res = await fetch(`${DE_BASE}/de/${ref}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
        signal: controller.signal,
      })
    } catch (err) {
      if (err && err.name === 'AbortError') {
        const e = new Error(`Request to ${DE_BASE}/de/${ref}/run timed out`)
        e.status = 0
        throw e
      }
      const e = new Error(`Network error contacting ${DE_BASE}/de/${ref}/run`)
      e.status = 0
      throw e
    }
    if (!res.ok) { const e = new Error('run failed'); e.status = res.status; throw e }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}
