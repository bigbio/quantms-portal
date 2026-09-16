// Web Worker that owns the Baseline expression databases. Downloading,
// decompressing and parsing the multi-megabyte gzip JSON happens here, and only
// the few requested entries are posted back, so the page stays responsive.
import { BASELINE_SOURCES, createDbLoader, loadGzipJson } from '../utils/baseline.js'

let baseUrl = '/'
const loader = createDbLoader((source) => loadGzipJson(new URL(`${baseUrl}${BASELINE_SOURCES[source]}`, self.location.origin).href))

self.onmessage = async (event) => {
  const { id, source, query, base } = event.data || {}
  if (base) baseUrl = base
  try {
    const db = await loader.get(source)
    self.postMessage({ id, entry: db[String(query || '').toUpperCase()] || null })
  } catch (e) {
    self.postMessage({ id, error: (e && e.message) || String(e) })
  }
}
