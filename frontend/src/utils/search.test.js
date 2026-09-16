import { describe, it, expect } from 'vitest'
import { normalizeSearchResult } from './search.js'

describe('normalizeSearchResult', () => {
  it('keeps a well-formed response intact', () => {
    const data = { datasets: [{ dataset_ref: 'a' }], total_datasets: 5, extra: 1 }
    expect(normalizeSearchResult(data)).toEqual(data)
  })

  it('fills in missing datasets and totals', () => {
    expect(normalizeSearchResult({})).toEqual({ datasets: [], total_datasets: 0 })
    expect(normalizeSearchResult(null)).toEqual({ datasets: [], total_datasets: 0 })
    expect(normalizeSearchResult({ datasets: [{}, {}] }).total_datasets).toBe(2)
    expect(normalizeSearchResult({ datasets: 'oops', total_datasets: '3' })).toEqual({ datasets: [], total_datasets: 3 })
  })
})
