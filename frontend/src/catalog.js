import { apiGet } from './api.js'
import { DATASET_SEARCH_BASE } from './config.js'

// Distinct datasets (dataset_ref) and source accessions in the published catalogue.
// Unlike the sum of per-collection dataset_count, a dataset listed in more than one
// collection is counted once.
export async function countDistinctDatasets() {
  const refs = new Set()
  const accessions = new Set()
  let pages = 1
  for (let page = 1; page <= pages; page++) {
    const data = await apiGet(DATASET_SEARCH_BASE, '/datasets', { page, page_size: 200 })
    pages = data.total_pages || 1
    for (const d of data.datasets || []) {
      refs.add(d.dataset_ref)
      accessions.add(d.accession)
    }
  }
  return { datasets: refs.size, accessions: accessions.size }
}
