// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('chart.js', () => {
  class Chart { constructor() {} update() {} destroy() {} }
  Chart.register = () => {}
  return { Chart, ScatterController: {}, PointElement: {}, LinearScale: {}, Tooltip: {}, Legend: {} }
})

import DeQcPanel, { pcaToScatter, qcChips, fmtScore } from './DeQcPanel.vue'
import ScatterChart from './ScatterChart.vue'

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
