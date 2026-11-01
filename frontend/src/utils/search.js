// Shared helpers for the search views.

/**
 * Normalize a peptide/protein search response so the view can rely on
 * `datasets` being an array and `total_datasets` being a number, even when the
 * backend omits either field.
 */
export function normalizeSearchResult(data) {
  const datasets = Array.isArray(data?.datasets) ? data.datasets : []
  const total = Number(data?.total_datasets)
  return {
    ...(data && typeof data === 'object' ? data : {}),
    datasets,
    total_datasets: Number.isFinite(total) ? total : datasets.length,
  }
}

// Home search box (same rules as the quantms.org search): what kind of query the text looks like.
export function guessSearchKind(q) {
  if (/^(PXD|MSV|PDC|JPST|IPX|PRD)\d+/i.test(q)) return 'dataset'
  if (/^[OPQ][0-9][A-Z0-9]{3}[0-9](-\d+)?$|^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}(-\d+)?$/i.test(q)) return 'protein'
  if (/^[ACDEFGHIKLMNPQRSTVWY]{7,}$/.test(q)) return 'peptide'
  if (/^[A-Za-z0-9-]{2,15}$/.test(q)) return 'protein'
  return 'dataset'
}

// Portal route for a home search; kind 'auto' guesses from the text.
export function searchRoute(q, kind = 'auto') {
  const k = kind === 'auto' ? guessSearchKind(q) : kind
  if (k === 'peptide') return { path: '/apps/peptide-search', query: { mode: 'peptide', sequence: q.toUpperCase() } }
  if (k === 'protein') return { path: '/apps/peptide-search', query: { mode: 'protein', query: q } }
  return { path: '/apps/dataset-search', query: { q } }
}
