// Dataset version paths + cached, best-effort evaluation record fetches.
import { apiGet } from '../api.js'
import { BROWSE_BASE, EVALUATION_PATH } from '../config.js'

// Portal page for one dataset version: /collections/<name>/<ACC>/<hash> (accession-only when no ref).
export function datasetPath(ds) {
  const target = ds.dataset_ref || ds.accession
  return `/collections/${encodeURIComponent(ds.collection)}/${target.split('/').map(encodeURIComponent).join('/')}`
}

const cache = new Map()

// Resolves to the evaluation record, or null when the version has not been evaluated (404) or the fetch fails.
export function fetchEvaluation(datasetRef) {
  if (!datasetRef) return Promise.resolve(null)
  if (!cache.has(datasetRef)) {
    const path = datasetRef.split('/').map(encodeURIComponent).join('/')
    cache.set(datasetRef, apiGet(BROWSE_BASE, `${EVALUATION_PATH}/${path}/evaluation.json`)
      .then((rec) => (rec && typeof rec === 'object' ? rec : null))
      .catch(() => null))
  }
  return cache.get(datasetRef)
}

export function _clearEvaluationCache() {
  cache.clear()
}
