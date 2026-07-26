import { describe, it, expect } from 'vitest'
import {
  datasetTitle,
  resultsSummary,
  contextChips,
  contrastLabel,
  contrastChips,
  datasetMatches,
} from './dataset.js'

describe('datasetTitle', () => {
  it('prefers the title, falls back to accession then ref', () => {
    expect(datasetTitle({ title: 'ChemBioID', accession: 'PXD041047' })).toBe('ChemBioID')
    expect(datasetTitle({ accession: 'PXD041047' })).toBe('PXD041047')
    expect(datasetTitle({ title: '   ', accession: 'PXD041047' })).toBe('PXD041047')
    expect(datasetTitle({ ref: 'PXD1/abc' })).toBe('PXD1/abc')
    expect(datasetTitle(null)).toBe('Unknown dataset')
  })
})

describe('resultsSummary', () => {
  it('formats the three counters in reading order', () => {
    const parts = resultsSummary({ n_quantified: 4094, n_significant: 20, n_on_off: 66 })
    expect(parts.map((p) => `${p.value} ${p.label}`)).toEqual([
      '4,094 quantified',
      '20 significant',
      '66 on/off',
    ])
    expect(parts[2].title).toMatch(/absent in the other/)
  })

  it('keeps a real zero (a measured outcome) but drops absent counters', () => {
    const parts = resultsSummary({ n_quantified: 1200, n_significant: 0 })
    expect(parts.map((p) => `${p.value} ${p.label}`)).toEqual([
      '1,200 quantified',
      '0 significant',
    ])
  })

  it('returns nothing at all when results are missing or malformed', () => {
    expect(resultsSummary(undefined)).toEqual([])
    expect(resultsSummary(null)).toEqual([])
    expect(resultsSummary({})).toEqual([])
    expect(resultsSummary({ n_quantified: null, n_significant: undefined })).toEqual([])
  })
})

describe('contextChips', () => {
  it('emits one chip per present key, in a fixed order, with cleaned instruments', () => {
    const chips = contextChips({
      acquisition: 'Data-independent acquisition',
      instrument: 'AC=MS:1002732;NT=Orbitrap Fusion Lumos',
      cell_line: 'HEK293',
      label: 'label free sample',
    })
    expect(chips.map((c) => c.value)).toEqual([
      'HEK293',
      'Orbitrap Fusion Lumos',
      'Data-independent acquisition',
      'label free sample',
    ])
    expect(chips[0].title).toBe('Cell line: HEK293')
  })

  it('skips empty values and still surfaces unknown keys, humanized', () => {
    const chips = contextChips({ disease: '', cell_line: null, sample_prep: 'FASP' })
    expect(chips).toEqual([
      { key: 'sample_prep', label: 'Sample prep', value: 'FASP', title: 'Sample prep: FASP' },
    ])
  })

  it('returns an empty list for a missing or non-object context', () => {
    expect(contextChips(undefined)).toEqual([])
    expect(contextChips(null)).toEqual([])
    expect(contextChips([])).toEqual([])
    expect(contextChips('nope')).toEqual([])
  })
})

describe('contrastLabel / contrastChips', () => {
  it('prefers the label and makes a raw id readable', () => {
    expect(contrastLabel({ label: 'DMSO vs Pomalidomide' })).toBe('DMSO vs Pomalidomide')
    expect(contrastLabel({ id: 'DMSO__vs__Pomalidomide' })).toBe('DMSO vs Pomalidomide')
    expect(contrastLabel('A__vs__B')).toBe('A vs B')
    expect(contrastLabel(null)).toBe('')
    expect(contrastLabel({})).toBe('')
  })

  it('caps the chips and reports the overflow', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ id: `${x}__vs__ctrl`, label: `${x} vs ctrl` }))
    const { shown, extra } = contrastChips(many)
    expect(shown.map((c) => c.label)).toEqual(['a vs ctrl', 'b vs ctrl', 'c vs ctrl'])
    expect(extra).toBe(2)
  })

  it('drops unlabelable entries and handles a missing list', () => {
    expect(contrastChips([{ factor: 'compound' }, { id: 'A__vs__B', factor: 'compound' }])).toEqual({
      shown: [{ id: 'A__vs__B', label: 'A vs B', factor: 'compound' }],
      extra: 0,
    })
    expect(contrastChips(undefined)).toEqual({ shown: [], extra: 0 })
    expect(contrastChips(null)).toEqual({ shown: [], extra: 0 })
  })
})

describe('datasetMatches', () => {
  const d = {
    ref: 'PXD041047/9c38',
    accession: 'PXD041047',
    title: 'ChemBioID pomalidomide target proximity',
    organism: 'Homo sapiens',
    factors: ['compound'],
    contrasts: [{ id: 'DMSO__vs__Pomalidomide', label: 'DMSO vs Pomalidomide' }],
  }

  it('matches title, accession, organism, factor and contrast label, case-insensitively', () => {
    expect(datasetMatches(d, 'chembioid')).toBe(true)
    expect(datasetMatches(d, 'PXD0410')).toBe(true)
    expect(datasetMatches(d, 'homo')).toBe(true)
    expect(datasetMatches(d, 'compound')).toBe(true)
    expect(datasetMatches(d, 'pomalidomide')).toBe(true)
    expect(datasetMatches(d, 'mus musculus')).toBe(false)
  })

  it('matches everything on an empty query and survives sparse entries', () => {
    expect(datasetMatches(d, '')).toBe(true)
    expect(datasetMatches(d, '   ')).toBe(true)
    expect(datasetMatches({ accession: 'PXD1' }, 'pxd1')).toBe(true)
    expect(datasetMatches({}, 'x')).toBe(false)
    expect(datasetMatches(null, 'x')).toBe(false)
  })
})
