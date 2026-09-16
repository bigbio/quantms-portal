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
