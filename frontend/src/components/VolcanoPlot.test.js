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
import { REGULATION_META } from '../utils/regulation.js'

// The three datasets are keyed by label: "Up" / "Down" / "Not significant".
const byLabel = (d, label) => d.datasets.find((s) => s.label === label)

describe('toVolcanoData', () => {
  const rows = [
    { protein: 'P1', log2fc: 2, adj_pvalue: 0.01, significant: true },
    { protein: 'P2', log2fc: 0.1, adj_pvalue: 0.9, significant: false },
    { protein: 'P3', log2fc: -2, adj_pvalue: 0.01, significant: true },
  ]

  it('maps rows to x=log2fc, y=-log10(adjP) and splits into three datasets', () => {
    const d = toVolcanoData(rows)
    expect(d.datasets.map((s) => s.label)).toEqual(['Up', 'Down', 'Not significant'])
    const up = byLabel(d, 'Up')
    expect(up.data).toHaveLength(1)
    expect(up.data[0]).toMatchObject({ x: 2, protein: 'P1' })
    expect(up.data[0].y).toBeCloseTo(2, 5) // -log10(0.01) = 2
  })

  it('puts significant negative fold changes in the Down dataset', () => {
    const d = toVolcanoData(rows)
    const down = byLabel(d, 'Down')
    expect(down.data).toHaveLength(1)
    expect(down.data[0]).toMatchObject({ x: -2, protein: 'P3' })
    expect(down.data[0].y).toBeCloseTo(2, 5)
  })

  it('puts non-significant rows in the other dataset regardless of direction', () => {
    const d = toVolcanoData([
      ...rows,
      { protein: 'P4', log2fc: -3, adj_pvalue: 0.9, significant: false },
    ])
    const other = byLabel(d, 'Not significant')
    expect(other.data.map((p) => p.protein)).toEqual(['P2', 'P4'])
    expect(other.data[0]).toMatchObject({ x: 0.1, protein: 'P2' })
  })

  it('colors up red, down blue and non-significant grey', () => {
    const d = toVolcanoData(rows)
    const up = byLabel(d, 'Up')
    const down = byLabel(d, 'Down')
    const ns = byLabel(d, 'Not significant')
    expect(up.backgroundColor).toBe(REGULATION_META.up.color)
    expect(down.backgroundColor).toBe(REGULATION_META.down.color)
    expect(ns.backgroundColor).toBe(REGULATION_META.ns.color)
    // Border matches the fill, and the three are visually distinct.
    for (const s of d.datasets) expect(s.borderColor).toBe(s.backgroundColor)
    expect(new Set(d.datasets.map((s) => s.backgroundColor)).size).toBe(3)
  })

  it('keeps significant-but-zero/null fold changes out of Up and Down', () => {
    const d = toVolcanoData([
      { protein: 'Z', log2fc: 0, adj_pvalue: 0.01, significant: true },
      { protein: 'N', log2fc: null, adj_pvalue: 0.01, significant: true },
    ])
    expect(byLabel(d, 'Up').data).toHaveLength(0)
    expect(byLabel(d, 'Down').data).toHaveLength(0)
    expect(byLabel(d, 'Not significant').data.map((p) => p.protein)).toEqual(['Z', 'N'])
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

  it('handles an empty rows array but keeps all three datasets', () => {
    const d = toVolcanoData([])
    expect(d.datasets).toHaveLength(3)
    expect(d.datasets.every((s) => s.data.length === 0)).toBe(true)
  })
})

describe('VolcanoPlot component', () => {
  it('mounts and renders a chart', () => {
    const rows = [{ protein: 'P1', log2fc: 2, adj_pvalue: 0.01, significant: true }]
    const w = mount(VolcanoPlot, { props: { rows } })
    expect(w.findComponent(ScatterChart).exists() || w.find('canvas').exists()).toBe(true)
  })

  it('passes the three regulation datasets to the chart', () => {
    const rows = [
      { protein: 'P1', log2fc: 2, adj_pvalue: 0.01, significant: true },
      { protein: 'P2', log2fc: -2, adj_pvalue: 0.01, significant: true },
      { protein: 'P3', log2fc: 0.1, adj_pvalue: 0.9, significant: false },
    ]
    const w = mount(VolcanoPlot, { props: { rows } })
    const data = w.findComponent(ScatterChart).props('data')
    expect(data.datasets.map((s) => s.label)).toEqual(['Up', 'Down', 'Not significant'])
    expect(data.datasets.map((s) => s.data.length)).toEqual([1, 1, 1])
  })

  it('emits select with the protein on point click', async () => {
    const rows = [{ protein: 'P1', log2fc: 2, adj_pvalue: 0.01, significant: true }]
    const w = mount(VolcanoPlot, { props: { rows } })
    const scatter = w.findComponent(ScatterChart)
    scatter.vm.$emit('point-click', { x: 2, y: 2, protein: 'P1' })
    expect(w.emitted('select')).toEqual([['P1']])
  })
})
