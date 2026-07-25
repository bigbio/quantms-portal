// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('chart.js', () => {
  class Chart {
    constructor() {}
    update() {}
    destroy() {}
  }
  Chart.register = () => {}
  return { Chart, ScatterController: {}, PointElement: {}, LinearScale: {}, Tooltip: {}, Legend: {} }
})

import VolcanoPlot, { toVolcanoData } from './VolcanoPlot.vue'
import ScatterChart from './ScatterChart.vue'

describe('toVolcanoData', () => {
  it('maps rows to x=log2fc, y=-log10(adjP) and splits by significance', () => {
    const rows = [
      { protein: 'P1', log2fc: 2, adj_pvalue: 0.01, significant: true },
      { protein: 'P2', log2fc: 0.1, adj_pvalue: 0.9, significant: false },
    ]
    const d = toVolcanoData(rows)
    const sig = d.datasets.find((s) => s.label.toLowerCase().includes('sig'))
    expect(sig.data[0]).toMatchObject({ x: 2, protein: 'P1' })
    expect(sig.data[0].y).toBeCloseTo(2, 5) // -log10(0.01) = 2
  })

  it('puts non-significant rows in the other dataset', () => {
    const rows = [
      { protein: 'P1', log2fc: 2, adj_pvalue: 0.01, significant: true },
      { protein: 'P2', log2fc: 0.1, adj_pvalue: 0.9, significant: false },
    ]
    const d = toVolcanoData(rows)
    const other = d.datasets.find((s) => s.data.some((p) => p.protein === 'P2'))
    expect(other.data).toHaveLength(1)
    expect(other.data[0]).toMatchObject({ x: 0.1, protein: 'P2' })
  })

  it('skips rows with null/zero/negative adj_pvalue', () => {
    const rows = [
      { protein: 'P1', log2fc: 1, adj_pvalue: 0, significant: true },
      { protein: 'P2', log2fc: 1, adj_pvalue: null, significant: true },
      { protein: 'P3', log2fc: 1, adj_pvalue: -0.1, significant: true },
      { protein: 'P4', log2fc: 1, adj_pvalue: 0.05, significant: true },
    ]
    const d = toVolcanoData(rows)
    const all = d.datasets.flatMap((s) => s.data)
    expect(all.map((p) => p.protein)).toEqual(['P4'])
  })

  it('handles an empty rows array', () => {
    const d = toVolcanoData([])
    expect(d.datasets.every((s) => s.data.length === 0)).toBe(true)
  })
})

describe('VolcanoPlot component', () => {
  it('mounts and renders a chart', () => {
    const rows = [{ protein: 'P1', log2fc: 2, adj_pvalue: 0.01, significant: true }]
    const w = mount(VolcanoPlot, { props: { rows } })
    expect(w.findComponent(ScatterChart).exists() || w.find('canvas').exists()).toBe(true)
  })

  it('emits select with the protein on point click', async () => {
    const rows = [{ protein: 'P1', log2fc: 2, adj_pvalue: 0.01, significant: true }]
    const w = mount(VolcanoPlot, { props: { rows } })
    const scatter = w.findComponent(ScatterChart)
    scatter.vm.$emit('point-click', { x: 2, y: 2, protein: 'P1' })
    expect(w.emitted('select')).toEqual([['P1']])
  })
})
