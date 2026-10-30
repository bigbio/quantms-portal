import { describe, it, expect } from 'vitest'
import { colourFields, colourScale, runAnnotation, NOT_ANNOTATED } from './sampleColors.js'
import { CATEGORICAL, shades } from './utils/chartColors.js'

const samples = (values, field = 'organism_part') => values.map((v, i) => ({ sample_accession: `S${i}`, [field]: v }))

const DIGESTIVE = { group: 'Digestive system', colour: CATEGORICAL[2] }
const BLOOD = { group: 'Blood and immune system', colour: CATEGORICAL[7] }
const NONE = { group: 'Other or no organ system', colour: '#a3acb6' }

describe('colourScale', () => {
  it('without biological groups, colours the largest values by rank and folds the rest into Other', () => {
    const lines = ['c1', 'c1', 'c1', 'c2', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'not applicable']
    const s = colourScale(samples(lines, 'cell_line'), 'cell_line')
    expect(s.legend.map((l) => l.label)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'Other (2)', NOT_ANNOTATED])
    expect(s.colourOf('c1')).toBe(CATEGORICAL[0])
    expect(s.splitOf('c9')).toBe('Other (2)')
    expect(s.splitOf(null)).toBe(NOT_ANNOTATED)
    // the chart of the field lists the coloured values, not grey ones one by one
    expect(s.values.map((v) => v.label)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'Other (2)', NOT_ANNOTATED])
  })

  it('gives a value its group\'s hue, in shades, the same whichever dataset it is in', () => {
    const groupOf = (v) => ({ stomach: DIGESTIVE, liver: DIGESTIVE, 'lymph node': BLOOD, ascites: NONE })[v]
    const s = colourScale(samples(['stomach', 'stomach', 'liver', 'lymph node', 'ascites']), 'organism_part', groupOf)
    expect(s.colourOf('stomach')).toBe(CATEGORICAL[2])
    expect(s.colourOf('liver')).toBe(shades(CATEGORICAL[2], 2)[1])
    expect(s.colourOf('lymph node')).toBe(CATEGORICAL[7])
    // legend in the group table's order, grey groups last; each value under its group
    expect(s.legend.map((l) => [l.label, l.family])).toEqual([
      ['lymph node', 'Blood and immune system'], ['stomach', 'Digestive system'], ['liver', 'Digestive system'],
      ['ascites', 'Other or no organ system'],
    ])
    // a legend group highlights its values
    expect(s.matches('liver', 'Digestive system')).toBe(true)
    expect(s.matches('lymph node', 'Digestive system')).toBe(false)
  })

  it('draws one group per biological group when there are too many values', () => {
    const tissues = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']
    const s = colourScale(samples(tissues), 'organism_part', (v) => (v === 't9' ? BLOOD : DIGESTIVE))
    expect(s.splits.map((x) => x.label)).toEqual(['Blood and immune system', 'Digestive system'])
    expect(s.splitOf('t3')).toBe('Digestive system')
    expect(s.rankOf('t9')).toBe(0)
  })

  it('orders developmental stages from early to late, light to dark', () => {
    const s = colourScale(samples(['adult', 'infant', 'adult', 'juvenile stage'], 'developmental_stage'), 'developmental_stage')
    expect(s.splits.map((x) => x.label)).toEqual(['infant', 'juvenile stage', 'adult'])
  })

  it('keeps fixed colours for sex whatever the counts', () => {
    const a = colourScale(samples(['female', 'male', 'male'], 'sex'), 'sex')
    const b = colourScale(samples(['female', 'female', 'Male'], 'sex'), 'sex')
    expect(a.colourOf('female')).toBe(b.colourOf('female'))
    expect(a.colourOf('male')).toBe(b.colourOf('Male'))
  })
})

describe('colourFields', () => {
  it('offers fields that group samples, not ones that name each sample', () => {
    const rows = ['lung', 'lung', 'skin', 'skin'].map((t, i) => ({ organism_part: t, cell_line: `L${i}`, sex: 'female' }))
    expect(colourFields(rows).map((f) => f.key)).toEqual(['organism_part'])
  })
})

describe('runAnnotation', () => {
  const byId = new Map(samples(['lung', 'skin', 'not applicable']).map((s) => [s.sample_accession, s]))
  it('gives a run its samples\' shared value, ignoring pooled references', () => {
    expect(runAnnotation(['S0', 'S2'], byId, 'organism_part')).toEqual({ mixed: false, value: 'lung' })
  })
  it('marks a run of samples with different values as mixed', () => {
    expect(runAnnotation(['S0', 'S1'], byId, 'organism_part').mixed).toBe(true)
  })
})
