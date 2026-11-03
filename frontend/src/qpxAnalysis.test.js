import { describe, it, expect } from 'vitest'
import {
  analysisDesign, benjaminiHochberg, coexpressionSql, compareGroups, compareSql, correlationMatrix,
  heatmapSql, isReference, matrixSql, pca, proteinSql, tTwoSided, welch,
} from './qpxAnalysis.js'

// Reference values from scipy 1.17 (stats.t.sf, ttest_ind(equal_var=False),
// false_discovery_control) and numpy's SVD.
describe('statistics', () => {
  it('gives two-sided t p-values', () => {
    for (const [t, df, p] of [[2, 10, 0.07338803477074037], [3, 5, 0.030099247897462586], [0.5, 3.7, 0.6453356333199318],
      [12.8, 19.63, 5.5624890106888805e-11], [-1.2, 120.5, 0.23249330764832463], [40, 4, 2.3340163226012678e-06]]) {
      expect(tTwoSided(t, df) / p).toBeCloseTo(1, 9)
    }
  })

  it('runs Welch’s test from group summaries', () => {
    const r = welch({ k: 5, mu: 3, s2: 2.5 }, { k: 5, mu: 6.1, s2: 11.05 })
    expect(r.t).toBeCloseTo(-1.8831158916154396, 10)
    expect(r.df).toBeCloseTo(5.721820767028301, 10)
    expect(r.p).toBeCloseTo(0.1110540025998163, 10)
    expect(welch({ k: 3, mu: 1, s2: 0 }, { k: 3, mu: 2, s2: 0 })).toBeNull()
  })

  it('adjusts p-values by Benjamini–Hochberg in the input order', () => {
    const adj = benjaminiHochberg([0.01, 0.04, 0.03, 0.2])
    ;[0.04, 0.05333333333333333, 0.05333333333333333, 0.2].forEach((v, i) => expect(adj[i]).toBeCloseTo(v, 12))
  })

  it('compares groups, testing only proteins with enough values in both', () => {
    const rows = [
      ['A', ['P1', 'P2', 'P3', 'P4'], [5, 3, 4, 2], [3, 1, 2, 0], [2.5, 0.5, 1, 0.1]],
      ['B', ['P1', 'P2', 'P5'], [5, 2, 3], [6.1, 1, 0], [11.05, 0.2, 0.3]],
    ]
    const res = compareGroups(rows)
    expect(res.tested.map((r) => r.protein)).toEqual(['P1'])
    expect(res.tested[0].log2fc).toBeCloseTo(-3.1, 12)
    expect(res.tested[0].adj_pvalue).toBeCloseTo(0.1110540025998163, 10)
    // P3 only in A with 4 values; P5 only in B with 3; P2 has 2 values in B, P4 2 in A
    expect(res.onlyA.map((r) => r.protein)).toEqual(['P3'])
    expect(res.onlyB.map((r) => r.protein)).toEqual(['P5'])
    expect(res.untested).toBe(2)
  })
})

describe('sample map', () => {
  const X = [[1, 2, 3, 4], [2, 1, 4, 3], [5, 6, 5, 8], [6, 5, 7, 6], [0, 1, 1, 0]]

  it('finds principal components with a fixed sign', () => {
    const { scores, explained } = pca(X)
    ;[0.9057620308144377, 0.06459081476556369, 0.02839229839692749].forEach((v, i) => expect(explained[i]).toBeCloseTo(v, 8))
    // the sample furthest out (the last) is on the positive side of PC1
    ;[1.917413080357527, 2.0341638063156253, -5.173740833871883, -4.8807182125583815, 6.102882159757116]
      .forEach((v, i) => expect(scores[i][0]).toBeCloseTo(v, 6))
  })

  it('correlates samples', () => {
    const r = correlationMatrix(X)
    expect(r[0][1]).toBeCloseTo(0.6, 12)
    expect(r[2][4]).toBeCloseTo(-0.40824829046386296, 12)
    expect(r[3][3]).toBe(1)
  })
})

describe('design and SQL', () => {
  const lf = [{ run_file_name: 'r1', samples: [{ sample_accession: 'S1' }] }, { run_file_name: 'r2', samples: [{ sample_accession: 'S2' }] }]
  const tmt = [{ run_file_name: 'f1', samples: [{ sample_accession: 'S1' }, { sample_accession: 'S2' }, { sample_accession: 'B1' }] }]
  const samples = [
    { sample_accession: 'S1', pooled_sample: 'not pooled' },
    { sample_accession: 'S2', pooled_sample: 'not pooled' },
    { sample_accession: 'B1', pooled_sample: 'SN=A;SN=B' },
  ]

  it('recognises pooled references', () => {
    expect(isReference(samples[2])).toBe(true)
    expect(isReference(samples[0])).toBe(false)
    expect(isReference({ sample_accession: 'X' })).toBe(false)
  })

  it('corrects multiplexed data by the reference, else by the plex', () => {
    expect(analysisDesign(lf, samples)).toEqual({ mode: 'none', references: [] })
    expect(analysisDesign(tmt, samples)).toEqual({ mode: 'bridge', references: ['B1'] })
    expect(analysisDesign(tmt, samples.slice(0, 2))).toEqual({ mode: 'centre', references: [] })
  })

  it('builds the SQL of each design', () => {
    const bridge = { mode: 'bridge', references: ['B1'] }
    const sql = matrixSql(bridge)
    expect(sql).toContain("WHERE sample IN ('B1')")
    expect(sql).toContain("WHERE c.sample NOT IN ('B1')")
    expect(matrixSql({ mode: 'centre', references: [] })).toContain('OVER (PARTITION BY prot, plex)')
    expect(matrixSql({ mode: 'none', references: [] })).not.toContain('PARTITION BY')
    // sample medians come from every protein, the protein filter applies after them
    expect(proteinSql(bridge, "P'1")).toContain("JOIN med USING (sample) WHERE m.prot = 'P''1'")
    expect(compareSql(bridge, ['S1'], ['S2'])).toContain("CASE WHEN sample IN ('S1') THEN 'A' ELSE 'B' END")
    expect(coexpressionSql(bridge, 'P1')).toContain("x AS (SELECT sample, v FROM n WHERE prot = 'P1')")
    expect(heatmapSql(bridge, ['hsp90aa1'])).toContain("upper(id) IN ('HSP90AA1')")
  })
})
