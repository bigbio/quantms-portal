// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('chart.js', () => {
  class Chart { constructor() {} update() {} destroy() {} }
  Chart.register = () => {}
  return { Chart, ScatterController: {}, PointElement: {}, LinearScale: {}, Tooltip: {}, Legend: {} }
})

import DeQcPanel, { pcaToScatter } from './DeQcPanel.vue'
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
})
