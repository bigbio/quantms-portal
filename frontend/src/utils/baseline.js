// Data helpers for the Baseline Expression view. The expression databases are
// large gzip JSON files, so each source is downloaded at most once per page:
// concurrent callers share the same in-flight promise, and a failed download is
// dropped from the cache so it can be retried.

export const BASELINE_SOURCES = {
  tissue: 'data/tissueJson.json.gz',
  cell: 'data/cellJson.json.gz',
}

/** Fetch a JSON file that may be served gzip-compressed without Content-Encoding. */
export async function loadGzipJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  const buf = await response.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
  if (!isGzip) return JSON.parse(new TextDecoder().decode(bytes))
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress the expression database. Please use a current browser.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text())
}

/** Index entries by upper-cased accession and gene name. */
export function buildIndex(entries) {
  const idx = {}
  for (const entry of entries || []) {
    if (entry.name) idx[String(entry.name).toUpperCase()] = entry
    if (entry.gene_name) idx[String(entry.gene_name).toUpperCase()] = entry
  }
  return idx
}

/**
 * Create a per-source database loader that de-duplicates concurrent downloads.
 * `fetchSource(source)` must resolve to the raw entries (array or object).
 */
export function createDbLoader(fetchSource) {
  const cache = new Map()
  const loaded = new Set()
  return {
    isLoaded: (source) => loaded.has(source),
    get(source) {
      if (!cache.has(source)) {
        const p = Promise.resolve()
          .then(() => fetchSource(source))
          .then((raw) => {
            loaded.add(source)
            return buildIndex(Array.isArray(raw) ? raw : Object.values(raw || {}))
          })
          .catch((e) => {
            cache.delete(source)
            throw e
          })
        cache.set(source, p)
      }
      return cache.get(source)
    },
  }
}

/** True when `entry` (resolved from the database) is already in `proteins`. */
export function isAlreadyAdded(proteins, entry) {
  return (proteins || []).some((p) => p.name === entry.name)
}

/** Quantile of an ascending-sorted array with linear interpolation (R type 7). */
export function quantile(sorted, q) {
  const n = sorted.length
  if (!n) return null
  const pos = (n - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/** Five-number summary + count per tag (tissue / cell line) for one entry. */
export function computeStats(entry) {
  const statsMap = {}
  if (!entry || !entry.tags || !entry.data) return statsMap
  for (let i = 0; i < entry.tags.length; i++) {
    const vals = (entry.data[i] || []).filter((v) => Number.isFinite(v))
    if (vals.length === 0) continue
    const sorted = [...vals].sort((a, b) => a - b)
    statsMap[entry.tags[i]] = {
      min: sorted[0],
      q1: quantile(sorted, 0.25),
      median: quantile(sorted, 0.5),
      q3: quantile(sorted, 0.75),
      max: sorted[sorted.length - 1],
      count: sorted.length,
    }
  }
  return statsMap
}
