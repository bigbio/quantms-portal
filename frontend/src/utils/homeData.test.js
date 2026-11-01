import { describe, it, expect } from 'vitest'
import { barRows, catalogueBreakdowns, spotlightIndex, spotlightFacts, SPOTLIGHT_PROTEINS } from './homeData.js'

describe('barRows', () => {
  it('sorts, caps and scales to the largest', () => {
    const rows = barRows([{ t: 'b', datasets: 5 }, { t: 'a', datasets: 10 }, { t: 'z', datasets: 0 }, { t: 'c', datasets: 1 }], 't', 2)
    expect(rows).toEqual([{ label: 'a', value: 10, share: 1 }, { label: 'b', value: 5, share: 0.5 }])
    expect(barRows(null, 't')).toEqual([])
  })
})

describe('spotlightIndex', () => {
  it('is stable within a day and moves on the next', () => {
    const a = spotlightIndex(new Date('2026-11-01T01:00:00Z'))
    expect(spotlightIndex(new Date('2026-11-01T23:00:00Z'))).toBe(a)
    expect(spotlightIndex(new Date('2026-11-02T01:00:00Z'))).toBe((a + 1) % SPOTLIGHT_PROTEINS.length)
  })
})

describe('spotlightFacts', () => {
  it('keeps biological PTMs and named tissues only', () => {
    const f = spotlightFacts({
      found: true, query: 'P02768', gene: 'ALB', name: 'Albumin', length: 609, coverage_pct: 99.8,
      n_peptides: 1342, n_datasets: 188,
      tissues: [{ value: 'liver', n_datasets: 10 }, { value: 'not available', n_datasets: 50 }, { value: 'blood plasma', n_datasets: 46 }],
      ptms: [{ site: 'Carbamidomethyl@C', n_datasets: 165, is_biological: false }, { site: 'Phospho@S', n_datasets: 12, is_biological: true }],
    })
    expect(f.tissues.map((t) => t.label)).toEqual(['blood plasma', 'liver'])
    expect(f.ptms).toEqual([{ site: 'Phospho@S', datasets: 12 }])
    expect(f.nTissues).toBe(3)
    expect(spotlightFacts({ found: false })).toBeNull()
  })
})

describe('catalogueBreakdowns', () => {
  it('counts each dataset once per value and merges instrument spellings', () => {
    const b = catalogueBreakdowns([
      { organism: 'homo sapiens', tissues: ['liver', 'liver', 'brain'], instrument: 'Q Exactive' },
      { organism: 'homo sapiens', tissues: [], instrument: 'NT=Q Exactive;AC=MS:1001911' },
      { organism: 'phage m13; escherichia coli', tissues: ['not available'], instrument: 'unknown' },
      { organism: null, tissues: [], instrument: '' },
    ])
    expect(b.organisms).toEqual([
      { label: 'Homo sapiens', value: 2, share: 1 },
      { label: 'Mixed (2 organisms)', value: 1, share: 0.5 },
    ])
    expect(b.tissues.map((t) => [t.label, t.value])).toEqual([['Liver', 1], ['Brain', 1]])
    expect(b.instruments).toEqual([{ label: 'Q Exactive', value: 2, share: 1 }])
    expect(b.nOrganisms).toBe(3)
  })
})
