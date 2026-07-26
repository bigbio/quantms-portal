// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('chart.js', () => {
  class Chart { constructor() {} update() {} destroy() {} }
  Chart.register = () => {}
  return { Chart, ScatterController: {}, PointElement: {}, LinearScale: {}, Tooltip: {}, Legend: {} }
})

import DeQcPanel, { pcaToScatter, qcChips, fmtScore, powerReplicateSummary } from './DeQcPanel.vue'
import ScatterChart from './ScatterChart.vue'
import QualityBadges from './QualityBadges.vue'

describe('pcaToScatter', () => {
  it('groups PCA points into per-group datasets', () => {
    const pca = [{ sample: 's1', pc1: 1, pc2: 2, group: 'A' }, { sample: 's2', pc1: -1, pc2: 0, group: 'B' }]
    const d = pcaToScatter(pca)
    expect(d.datasets.map(s => s.label).sort()).toEqual(['A', 'B'])
  })

  it('puts each point under its group with x=pc1, y=pc2, sample carried through', () => {
    const pca = [
      { sample: 's1', pc1: 1, pc2: 2, group: 'A' },
      { sample: 's2', pc1: -1, pc2: 0, group: 'B' },
      { sample: 's3', pc1: 3, pc2: 4, group: 'A' },
    ]
    const d = pcaToScatter(pca)
    const a = d.datasets.find((s) => s.label === 'A')
    expect(a.data).toEqual([
      { x: 1, y: 2, sample: 's1' },
      { x: 3, y: 4, sample: 's3' },
    ])
  })

  it('handles an empty/missing pca array', () => {
    expect(pcaToScatter([]).datasets).toEqual([])
    expect(pcaToScatter(undefined).datasets).toEqual([])
  })
})

describe('qcChips', () => {
  it('maps a full metrics object into labelled, formatted chips', () => {
    const chips = qcChips({
      replicate_correlation: { min: 0.977, per_group: {} },
      missingness: 0.079,
      pca_silhouette: 0.47,
      pi0: 0.64,
      n_significant: 22,
    })
    const byLabel = Object.fromEntries(chips.map((c) => [c.label, c.value]))
    expect(byLabel['Replicate r (min)']).toBe('0.977')
    expect(byLabel['Missingness']).toBe('7.9%')
    expect(byLabel['PCA silhouette']).toBe('0.47')
    expect(byLabel['π₀']).toBe('0.64')
    expect(byLabel['Significant']).toBe('22')
  })

  it('omits chips whose metric is missing/non-finite and handles empty input', () => {
    expect(qcChips(null)).toEqual([])
    expect(qcChips({})).toEqual([])
    const chips = qcChips({ missingness: 0.1 })
    expect(chips.map((c) => c.label)).toEqual(['Missingness'])
  })
})

describe('fmtScore', () => {
  it('formats finite numbers to 2 decimals and blanks non-finite', () => {
    expect(fmtScore(0.912)).toBe('0.91')
    expect(fmtScore(undefined)).toBe('')
    expect(fmtScore(NaN)).toBe('')
  })
})

const passQuality = {
  recommended_pipeline: { normalization: 'quantile', method: 'deqms' },
  scoreboard: [
    { normalization: 'quantile', method: 'deqms', score: 0.91, metrics: {} },
    { normalization: 'median', method: 'limma', score: 0.84, metrics: {} },
  ],
  per_contrast: {
    DMSO__vs__Pomalidomide: {
      metrics: {
        replicate_correlation: { min: 0.977, per_group: {} },
        missingness: 0.079,
        pca_silhouette: 0.47,
        pi0: 0.64,
        n_significant: 22,
      },
      gate: { status: 'pass', reasons: [] },
    },
  },
  quality: { status: 'pass', reasons: [] },
  pca: [{ sample: 's1', pc1: 1, pc2: 2, group: 'A' }],
}

describe('DeQcPanel component', () => {
  it('mounts a scatter chart for the PCA', () => {
    const qc = { pca: [{ sample: 's1', pc1: 1, pc2: 2, group: 'A' }], norm: { method: 'median' } }
    const w = mount(DeQcPanel, { props: { qc } })
    expect(w.findComponent(ScatterChart).exists()).toBe(true)
  })

  it('shows a placeholder when there is no PCA data', () => {
    const w = mount(DeQcPanel, { props: { qc: { pca: [], norm: {} } } })
    expect(w.findComponent(ScatterChart).exists()).toBe(false)
    expect(w.text().toLowerCase()).toContain('no')
  })

  it('renders the PASS badge, recommended pipeline and scoreboard for a quality block', () => {
    const w = mount(DeQcPanel, { props: { qc: passQuality } })
    const badge = w.find('.de-qc-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('PASS')
    expect(badge.classes()).toContain('de-qc-badge--pass')

    // Recommended pipeline caption.
    expect(w.text()).toContain('quantile · deqms')

    // Scoreboard rows render with the recommended row highlighted.
    const rows = w.findAll('.de-qc-scoreboard tbody tr')
    expect(rows).toHaveLength(2)
    expect(w.findAll('.de-qc-row--reco')).toHaveLength(1)
    expect(w.text()).toContain('0.91')

    // Metric chips render.
    expect(w.text()).toContain('7.9%')
  })

  it('shows reasons only when quality status is not pass', () => {
    const qc = {
      ...passQuality,
      quality: { status: 'warn', reasons: ['low replicate correlation'] },
    }
    const w = mount(DeQcPanel, { props: { qc } })
    expect(w.find('.de-qc-badge').text()).toBe('WARN')
    expect(w.find('.de-qc-reasons').exists()).toBe(true)
    expect(w.text()).toContain('low replicate correlation')
  })

  it('does not render the quality block (and does not error) when it is absent', () => {
    const qc = { pca: [{ sample: 's1', pc1: 1, pc2: 2, group: 'A' }], norm: { method: 'median' } }
    const w = mount(DeQcPanel, { props: { qc } })
    expect(w.find('.de-qc-quality').exists()).toBe(false)
    expect(w.find('.de-qc-badge').exists()).toBe(false)
    // The existing scatter still renders.
    expect(w.findComponent(ScatterChart).exists()).toBe(true)
  })
})

describe('powerReplicateSummary', () => {
  it('states the smallest group size and the per-group counts', () => {
    const s = powerReplicateSummary({
      level: 'moderate',
      min_replicates: 3,
      per_group: { DMSO: 3, Pomalidomide: 3 },
    })
    expect(s).toContain('3 replicates in the smallest group')
    expect(s).toContain('DMSO: 3')
    expect(s).toContain('Pomalidomide: 3')
  })

  it('uses the singular for a single replicate', () => {
    expect(powerReplicateSummary({ min_replicates: 1, per_group: { A: 1, B: 4 } })).toContain(
      '1 replicate in the smallest group',
    )
  })

  it('falls back to per-group counts alone when min_replicates is unavailable', () => {
    const s = powerReplicateSummary({ level: 'limited', min_replicates: null, per_group: { A: 2 } })
    expect(s).toBe('Replicates per group — A: 2')
  })

  it('returns an empty string for missing/empty/malformed input', () => {
    expect(powerReplicateSummary(null)).toBe('')
    expect(powerReplicateSummary(undefined)).toBe('')
    expect(powerReplicateSummary({})).toBe('')
    expect(powerReplicateSummary({ level: 'limited', reasons: ['x'] })).toBe('')
    expect(powerReplicateSummary('moderate')).toBe('')
  })
})

// PXD041047: pristine measurements but only n=3 per group — the case the two
// axes exist to describe.
const classifiedQc = {
  ...passQuality,
  per_contrast: {
    DMSO__vs__Pomalidomide: {
      ...passQuality.per_contrast.DMSO__vs__Pomalidomide,
      classification: {
        data_quality: { level: 'high', reasons: [] },
        statistical_power: {
          level: 'moderate',
          min_replicates: 3,
          per_group: { DMSO: 3, Pomalidomide: 3 },
          reasons: ['only 3 replicates in the smallest group; FDR correction limits detectable changes'],
        },
      },
    },
  },
}

describe('DeQcPanel two-axis classification', () => {
  it('renders both badges above the gate badge for a high/moderate dataset', () => {
    const w = mount(DeQcPanel, { props: { qc: classifiedQc } })
    const badges = w.findComponent(QualityBadges)
    expect(badges.exists()).toBe(true)
    expect(badges.text()).toContain('High')
    expect(badges.text()).toContain('Moderate')

    // The classification section precedes the pass/warn/fail gate section,
    // which answers a different question and is kept.
    const html = w.html()
    expect(html.indexOf('de-qc-class')).toBeLessThan(html.indexOf('de-qc-quality'))
    expect(w.find('.de-qc-badge').text()).toBe('PASS')
  })

  it('shows the replicate numbers and the reason behind a moderate power level', () => {
    const w = mount(DeQcPanel, { props: { qc: classifiedQc } })
    expect(w.find('.de-qc-class-detail').text()).toContain('3 replicates in the smallest group')
    expect(w.text()).toContain('DMSO: 3')
    expect(w.text()).toContain('FDR correction limits detectable changes')
    // The underlying metrics stay next to the badges — the badge summarizes,
    // it does not replace them.
    expect(w.text()).toContain('7.9%')
    expect(w.text()).toContain('0.977')
  })

  it('explains that the two axes are independent', () => {
    const w = mount(DeQcPanel, { props: { qc: classifiedQc } })
    expect(w.find('.de-qc-class-note').text()).toContain('independently')
  })

  it('falls back to a dataset-level classification block', () => {
    const qc = {
      ...passQuality,
      classification: {
        data_quality: { level: 'medium', reasons: ['missingness 0.31'] },
        statistical_power: { level: 'strong', min_replicates: 6, per_group: { A: 6, B: 7 } },
      },
    }
    const w = mount(DeQcPanel, { props: { qc } })
    expect(w.findComponent(QualityBadges).text()).toContain('Medium')
    expect(w.findComponent(QualityBadges).text()).toContain('Strong')
    expect(w.text()).toContain('missingness 0.31')
  })

  it('omits the classification section entirely for older datasets without it', () => {
    const w = mount(DeQcPanel, { props: { qc: passQuality } })
    expect(w.find('.de-qc-class').exists()).toBe(false)
    expect(w.findComponent(QualityBadges).exists()).toBe(false)
    // Everything that existed before still renders.
    expect(w.find('.de-qc-badge').text()).toBe('PASS')
    expect(w.findComponent(ScatterChart).exists()).toBe(true)
  })

  it('does not error when the classification block is present but empty', () => {
    const w = mount(DeQcPanel, { props: { qc: { ...passQuality, classification: {} } } })
    expect(w.find('.de-qc-class').exists()).toBe(false)
  })
})
