// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

vi.mock('./api.js', () => ({
  apiGet: vi.fn(async (base, path, params) => path === '/collections' ? { collections: [{ name: 'c1' }] } : ({
    total_pages: 2,
    datasets: params.page === 1
      ? [{ accession: 'PXD1', dataset_ref: 'PXD1/a' }, { accession: 'PXD1', dataset_ref: 'PXD1/b' }]
      : [{ accession: 'PXD1', dataset_ref: 'PXD1/a' }, { accession: 'PXD2', dataset_ref: 'PXD2/c' }],
  })),
}))
import { countDistinctDatasets, getCollections, lastCollections } from './catalog.js'

describe('countDistinctDatasets', () => {
  it('reads every page and counts a dataset listed in two collections once', async () => {
    expect(await countDistinctDatasets()).toEqual({ datasets: 3, accessions: 2 })
  })
})

describe('getCollections', () => {
  it('keeps the list for the next visit', async () => {
    expect(await getCollections()).toEqual([{ name: 'c1' }])
    expect(lastCollections()).toEqual([{ name: 'c1' }])
  })
})
