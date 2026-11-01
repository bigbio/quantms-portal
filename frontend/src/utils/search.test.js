import { describe, it, expect } from 'vitest'
import { normalizeSearchResult, guessSearchKind, searchRoute } from './search.js'

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

describe('guessSearchKind', () => {
  it('recognises datasets, proteins and peptides', () => {
    expect(guessSearchKind('PXD004452')).toBe('dataset')
    expect(guessSearchKind('P02768')).toBe('protein')
    expect(guessSearchKind('A0A024RBG1')).toBe('protein')
    expect(guessSearchKind('GAPDH')).toBe('protein')
    expect(guessSearchKind('LVNELTEFAK')).toBe('peptide')
    expect(guessSearchKind('breast cancer cell lines')).toBe('dataset')
  })
})

describe('searchRoute', () => {
  it('routes each kind to its portal app', () => {
    expect(searchRoute('LVNELTEFAK')).toEqual({ path: '/apps/peptide-search', query: { mode: 'peptide', sequence: 'LVNELTEFAK' } })
    expect(searchRoute('GAPDH')).toEqual({ path: '/apps/peptide-search', query: { mode: 'protein', query: 'GAPDH' } })
    expect(searchRoute('PXD004452')).toEqual({ path: '/apps/dataset-search', query: { q: 'PXD004452' } })
  })

  it('an explicit kind overrides the guess', () => {
    expect(searchRoute('lvneltefak', 'peptide')).toEqual({ path: '/apps/peptide-search', query: { mode: 'peptide', sequence: 'LVNELTEFAK' } })
    expect(searchRoute('GAPDH', 'dataset')).toEqual({ path: '/apps/dataset-search', query: { q: 'GAPDH' } })
  })
})
