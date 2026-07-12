// Single source of truth for backend hosts.
// Every view/API call reads from here — no hardcoded hosts anywhere else.
//
// Overridable at build time via Vite env (e.g. .env.local):
//   VITE_GATEWAY_BASE=https://publish.quantms.org
//   VITE_API_BASE=https://api.quantms.org
//   VITE_BROWSE_BASE=https://browse.quantms.org
// All consumed endpoints are public, read-only, CORS `*` — no secrets client-side.

const env = import.meta.env || {}

// Gateway (collections registry, app catalog, publish API).
export const GATEWAY_BASE = (env.VITE_GATEWAY_BASE || 'https://publish.quantms.org').replace(/\/$/, '')

// API hub; individual app backends live at `${API_BASE}/{app-id}`.
export const API_BASE = (env.VITE_API_BASE || 'https://api.quantms.org').replace(/\/$/, '')

// App backends derived from the API hub.
export const DATASET_SEARCH_BASE = `${API_BASE}/dataset-search`
export const PEPTIDE_SEARCH_BASE = `${API_BASE}/peptide-search`

// S3 browse host for dataset file downloads.
export const BROWSE_BASE = (env.VITE_BROWSE_BASE || 'https://browse.quantms.org').replace(/\/$/, '')

// Precomputed portal-wide statistics artifact (Tier-1 static app). The Statistics
// view reads this JSON directly from browse — no stats backend, no per-request compute.
export const STATS_PATH = '/quantms/apps/statistics/stats.json'

// API documentation hub.
export const API_DOCS_URL = `${API_BASE}/docs`

// Build a browse.quantms.org download folder URL from a dataset_ref ("ACC/hash")
// or an accession + hash. Returns '' when nothing usable is present.
export function browseUrl(datasetRef) {
  if (!datasetRef) return ''
  return `${BROWSE_BASE}/quantms/datasets/${datasetRef}/`
}
