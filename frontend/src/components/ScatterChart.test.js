// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScatterChart from './ScatterChart.vue'

describe('ScatterChart', () => {
  it('mounts with a canvas', () => {
    const w = mount(ScatterChart, {
      props: { data: { datasets: [{ label: 'x', data: [{ x: 1, y: 2 }] }] } },
    })
    expect(w.find('canvas').exists()).toBe(true)
  })
})
