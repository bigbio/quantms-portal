// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

const index = {
  proteins: [
    ['P25786', 'PSMA1', 7, 1500],
    ['P25787', 'PSMA2', 7, 1500],
  ],
  scopes: [
    { id: 'all', label: 'All lines', lines: 1500, datasets: ['PXD1'] },
    { id: 'breast', label: 'Breast', lines: 60, datasets: ['PXD2'] },
  ],
}
const psma1Network = { all: [['P25787', 'PSMA2', 0.91, 7, 1500, 1]] }

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import Coexpression from './Coexpression.vue'

async function mountView(path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Coexpression }],
  })
  router.push(path)
  await router.isReady()
  const w = mount(Coexpression, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

describe('Coexpression view', () => {
  beforeEach(() => { apiGet.mockReset() })

  it('lists every scope in the picker before a protein is selected', async () => {
    apiGet.mockResolvedValueOnce(index)
    const { w } = await mountView()
    const options = w.findAll('select')[0].findAll('option')
    expect(options.map((o) => o.attributes('value'))).toEqual(['all', 'breast'])
  })

  it('shows a retryable error when a network fails, and does not cache the failure', async () => {
    apiGet.mockResolvedValueOnce(index)
    const { w, router } = await mountView()

    apiGet.mockRejectedValueOnce(new Error('network down'))
    await w.find('.linkish').trigger('click') // "Try PSMA1"
    await flushPromises()
    expect(w.text()).toContain('Could not load the co-expression network for PSMA1')
    expect(w.text()).not.toContain('No partners pass')
    expect(router.currentRoute.value.query.protein).toBeUndefined()

    apiGet.mockResolvedValueOnce(psma1Network)
    const retry = w.findAll('button').find((b) => b.text() === 'Retry')
    await retry.trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Could not load')
    expect(w.find('table.partners').text()).toContain('PSMA2')
    expect(router.currentRoute.value.query.protein).toBe('P25786')
  })

  it('tells the user when Enter finds no matching protein', async () => {
    apiGet.mockResolvedValueOnce(index)
    const { w } = await mountView()
    const input = w.find('#coexp-search')
    await input.setValue('NOTAGENE')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.text()).toContain('No protein in the co-expression index matches')
    await input.setValue('PSMA')
    expect(w.text()).not.toContain('No protein in the co-expression index matches')
  })

  it('ignores a slow network that resolves after another protein was picked', async () => {
    apiGet.mockResolvedValueOnce(index)
    const { w, router } = await mountView()
    let resolveSlow
    apiGet.mockImplementation((base, path) =>
      path.endsWith('P25786.json')
        ? new Promise((r) => { resolveSlow = () => r(psma1Network) })
        : Promise.resolve({ all: [['P25786', 'PSMA1', 0.9, 7, 1500, 1]] }))

    const input = w.find('#coexp-search')
    await input.setValue('PSMA1')
    await input.trigger('keydown', { key: 'Enter' })
    await input.setValue('PSMA2')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.query.protein).toBe('P25787')

    resolveSlow()
    await flushPromises()
    expect(router.currentRoute.value.query.protein).toBe('P25787')
    expect(w.find('.chart-head h3').text()).toContain('PSMA2')
  })
})
