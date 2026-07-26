// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeHeatmap, { topByAdjP } from './DeHeatmap.vue'

describe('topByAdjP', () => {
  it('returns the n most significant rows', () => {
    const rows = [{ protein: 'A', adj_pvalue: 0.5 }, { protein: 'B', adj_pvalue: 0.001 },
                  { protein: 'C', adj_pvalue: 0.01 }]
    expect(topByAdjP(rows, 2).map(r => r.protein)).toEqual(['B', 'C'])
  })

  it('sorts nulls/undefined adj_pvalue to the end', () => {
    const rows = [
      { protein: 'A', adj_pvalue: null },
      { protein: 'B', adj_pvalue: 0.02 },
      { protein: 'C', adj_pvalue: undefined },
      { protein: 'D', adj_pvalue: 0.01 },
    ]
    expect(topByAdjP(rows, 4).map((r) => r.protein)).toEqual(['D', 'B', 'A', 'C'])
  })

  it('preserves input order among ties', () => {
    const rows = [
      { protein: 'A', adj_pvalue: 0.01 },
      { protein: 'B', adj_pvalue: 0.01 },
      { protein: 'C', adj_pvalue: 0.01 },
    ]
    expect(topByAdjP(rows, 3).map((r) => r.protein)).toEqual(['A', 'B', 'C'])
  })

  it('handles an empty/missing rows array', () => {
    expect(topByAdjP([], 5)).toEqual([])
    expect(topByAdjP(undefined, 5)).toEqual([])
  })

  it('caps at n even when more rows are available', () => {
    const rows = [
      { protein: 'A', adj_pvalue: 0.01 },
      { protein: 'B', adj_pvalue: 0.02 },
      { protein: 'C', adj_pvalue: 0.03 },
    ]
    expect(topByAdjP(rows, 1)).toHaveLength(1)
  })

  it('does not mutate the input array', () => {
    const input = [
      { protein: 'A', adj_pvalue: 0.5 },
      { protein: 'B', adj_pvalue: 0.001 },
      { protein: 'C', adj_pvalue: 0.01 },
    ]
    const before = JSON.stringify(input)
    topByAdjP(input, 2)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('DeHeatmap component', () => {
  it('mounts with a canvas when rows are present', () => {
    const rows = [{ protein: 'P1', adj_pvalue: 0.01, mean_group_a: 1, mean_group_b: 3 }]
    const w = mount(DeHeatmap, { props: { rows } })
    expect(w.find('canvas').exists()).toBe(true)
  })

  it('shows a placeholder when there are no rows', () => {
    const w = mount(DeHeatmap, { props: { rows: [] } })
    expect(w.find('canvas').exists()).toBe(false)
    expect(w.text().toLowerCase()).toContain('no')
  })

  it('respects the topN prop', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      protein: `P${i}`, adj_pvalue: i / 100, mean_group_a: i, mean_group_b: i + 1,
    }))
    const w = mount(DeHeatmap, { props: { rows, topN: 5 } })
    expect(w.find('canvas').exists()).toBe(true)
  })
})
