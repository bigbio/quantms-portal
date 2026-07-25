// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('chart.js', () => {
  class Chart { constructor() {} update() {} destroy() {} }
  Chart.register = () => {}
  return {
    Chart, BarController: {}, BarElement: {}, DoughnutController: {}, ArcElement: {},
    CategoryScale: {}, LinearScale: {}, Tooltip: {}, Legend: {},
  }
})

import ProteinBoxplot, { toBoxplotData } from './ProteinBoxplot.vue'
import StatsChart from './StatsChart.vue'

describe('toBoxplotData', () => {
  it('builds a two-bar dataset from the group means', () => {
    const d = toBoxplotData('P1', { mean_group_a: 2, mean_group_b: 5 })
    expect(d.labels).toEqual(['Group A', 'Group B'])
    expect(d.datasets[0].data).toEqual([2, 5])
    expect(d.datasets[0].label).toBe('P1')
  })
})

describe('ProteinBoxplot component', () => {
  it('shows a placeholder when no protein is selected', () => {
    const w = mount(ProteinBoxplot, { props: { protein: '', row: null } })
    expect(w.findComponent(StatsChart).exists()).toBe(false)
    expect(w.text().toLowerCase()).toContain('select a protein')
  })

  it('renders a bar chart when a protein + row are given', () => {
    const w = mount(ProteinBoxplot, {
      props: { protein: 'P1', row: { mean_group_a: 2, mean_group_b: 5 } },
    })
    const chart = w.findComponent(StatsChart)
    expect(chart.exists()).toBe(true)
    expect(chart.props('type')).toBe('bar')
  })
})
