import { describe, it, expect, vi } from 'vitest'

vi.mock('./api.js', () => ({
  apiGet: vi.fn(async (base, path, params) => ({
    total_pages: 2,
    datasets: params.page === 1
      ? [{ accession: 'PXD1', dataset_ref: 'PXD1/a' }, { accession: 'PXD1', dataset_ref: 'PXD1/b' }]
      : [{ accession: 'PXD1', dataset_ref: 'PXD1/a' }, { accession: 'PXD2', dataset_ref: 'PXD2/c' }],
  })),
}))
import { countDistinctDatasets } from './catalog.js'

describe('countDistinctDatasets', () => {
  it('reads every page and counts a dataset listed in two collections once', async () => {
    expect(await countDistinctDatasets()).toEqual({ datasets: 3, accessions: 2 })
  })
})
