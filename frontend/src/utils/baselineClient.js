// Lookup client for the Baseline expression databases. Uses a Web Worker when
// available so the heavy download/parse runs off the main thread; falls back to
// an in-thread loader (tests, very old browsers).
import { BASELINE_SOURCES, createDbLoader, loadGzipJson } from './baseline.js'

function defaultCreateWorker() {
  if (typeof Worker === 'undefined') return null
  try {
    return new Worker(new URL('../workers/baseline.worker.js', import.meta.url), { type: 'module' })
  } catch {
    return null
  }
}

export function createBaselineClient({ base = '/', createWorker = defaultCreateWorker } = {}) {
  const loaded = new Set()
  let worker = null
  let workerFailed = false
  let nextId = 0
  const pending = new Map()
  let local = null

  function localLoader() {
    if (!local) local = createDbLoader((source) => loadGzipJson(`${base}${BASELINE_SOURCES[source]}`))
    return local
  }

  function getWorker() {
    if (worker || workerFailed) return worker
    worker = createWorker()
    if (!worker) { workerFailed = true; return null }
    worker.onmessage = (event) => {
      const { id, entry, error } = event.data || {}
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (error) p.reject(new Error(error))
      else { loaded.add(p.source); p.resolve(entry) }
    }
    worker.onerror = (event) => {
      // The worker could not start or crashed: fail in-flight lookups and use
      // the in-thread loader from now on.
      workerFailed = true
      worker = null
      for (const p of pending.values()) p.reject(new Error((event && event.message) || 'Expression worker failed'))
      pending.clear()
    }
    return worker
  }

  return {
    isLoaded: (source) => loaded.has(source),
    /** Resolve the entry for an accession or gene in `source`, or null. */
    async lookup(source, query) {
      const w = getWorker()
      if (w) {
        const id = ++nextId
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject, source })
          w.postMessage({ id, source, query, base })
        })
      }
      const db = await localLoader().get(source)
      loaded.add(source)
      return db[String(query || '').toUpperCase()] || null
    },
    terminate() {
      if (worker) worker.terminate()
      worker = null
      pending.clear()
    },
  }
}
