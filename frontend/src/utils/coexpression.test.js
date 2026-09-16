import { describe, it, expect } from 'vitest'
import {
  networkFile, partnerRow, findProteins, partnersFor, scopesWithData, scopeOptions, radialLayout, edgeWidth,
} from './coexpression.js'

const proteins = [
  ['P25786', 'PSMA1', 7, 1500],
  ['P25787', 'PSMA2', 7, 1500],
  ['Q9Y2B0', 'CNPY2', 3, 400],
  ['P00533', 'EGFR', 6, 1200],
]

const network = {
    all: [
      ['P25787', 'PSMA2', 0.91, 7, 1500, 1],
      ['P20618', 'PSMB1', 0.88, 7, 1500, 1],
      ['Q99436', 'PSMB7', -0.35, 4, 900, 0.75],
      ['P12345', 'XYZ', 0.2, 2, 100, 0.5],
    ],
    breast: [['P25787', 'PSMA2', 0.8, 2, 60, 1]],
}

describe('coexpression helpers', () => {
  it('names network files like builder.network_file', () => {
    expect(networkFile('P25786')).toBe('P25786')
    expect(networkFile('P12345-2')).toBe('P12345-2')
    expect(networkFile('sp|X/Y')).toBe('sp_X_Y')
    expect(networkFile('')).toBe('_')
  })

  it('maps positional rows through the published column order', () => {
    expect(partnerRow(['P25787', 'PSMA2', 0.91, 7, 1500, 1])).toEqual({
      protein: 'P25787', gene: 'PSMA2', r: 0.91, n_datasets: 7, n_lines: 1500, sign_agree: 1,
    })
  })

  it('ranks an exact gene hit before prefix hits', () => {
    expect(findProteins(proteins, 'psma1')[0][1]).toBe('PSMA1')
    expect(findProteins(proteins, 'PSMA').map((p) => p[1])).toEqual(['PSMA1', 'PSMA2'])
    expect(findProteins(proteins, 'P00533')[0][1]).toBe('EGFR')
    expect(findProteins(proteins, '')).toEqual([])
  })

  it('filters partners by |r|, sign and topN, keeping strongest-first order', () => {
    expect(partnersFor(network, 'all', { minAbsR: 0.3 }).map((p) => p.gene))
      .toEqual(['PSMA2', 'PSMB1', 'PSMB7'])
    expect(partnersFor(network, 'all', { sign: 'negative' }).map((p) => p.gene)).toEqual(['PSMB7'])
    expect(partnersFor(network, 'all', { topN: 1 })).toHaveLength(1)
    expect(partnersFor(null, 'all')).toEqual([])
  })

  it('only offers scopes the protein has partners in', () => {
    const scopes = [{ id: 'all' }, { id: 'breast' }, { id: 'lung' }]
    expect(scopesWithData(network, scopes).map((s) => s.id)).toEqual(['all', 'breast'])
  })

  it('offers every scope before a network is loaded, then only populated ones', () => {
    const scopes = [{ id: 'all' }, { id: 'breast' }, { id: 'lung' }]
    expect(scopeOptions(undefined, scopes).map((s) => s.id)).toEqual(['all', 'breast', 'lung'])
    expect(scopeOptions(network, scopes).map((s) => s.id)).toEqual(['all', 'breast'])
    expect(scopeOptions(undefined, undefined)).toEqual([])
  })

  it('lays strongest partners closer to the centre, first at 12 o\'clock', () => {
    const nodes = radialLayout(partnersFor(network, 'all'), { cx: 0, cy: 0, radius: 100 })
    expect(nodes[0].x).toBeCloseTo(0, 5)
    expect(nodes[0].y).toBeLessThan(0)
    const dist = (n) => Math.hypot(n.x, n.y)
    expect(dist(nodes[0])).toBeLessThan(dist(nodes[3]))
    expect(edgeWidth(0.9)).toBeGreaterThan(edgeWidth(0.3))
  })
})
