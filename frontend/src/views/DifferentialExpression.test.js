// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../de.js', () => ({
  listDatasets: vi.fn(async () => ({
    datasets: [{ ref: 'PXD1/h', accession: 'PXD1', title: 't', organism: 'Homo sapiens', n_samples: 4, factors: ['compound'] }],
    count: 1,
  })),
  getDesign: vi.fn(),
  getDefault: vi.fn(),
  getQc: vi.fn(),
  runDe: vi.fn(),
}))

import DifferentialExpression from './DifferentialExpression.vue'
import { listDatasets } from '../de.js'

describe('DifferentialExpression view', () => {
  it('loads datasets and renders the picker', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    expect(listDatasets).toHaveBeenCalled()
    expect(w.text()).toContain('t')
    expect(w.text()).toContain('PXD1')
  })

  it('selecting a dataset syncs the ref into the URL', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    await w.find('tr.de-row').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.ref).toBe('PXD1/h')
    expect(w.text()).toContain('Selected dataset')
  })
})
