// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import DatasetSearch from './DatasetSearch.vue'

function backend(datasets) {
  apiGet.mockImplementation((base, path, params) => {
    if (path === '/datasets') return datasets(params)
    return Promise.resolve({})
  })
}
const page = (acc) => Promise.resolve({ datasets: [{ accession: acc, collection: 'msnet' }], total: 1, total_pages: 1 })
const datasetCalls = () => apiGet.mock.calls.filter((c) => c[1] === '/datasets')

async function mountAt(url) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/apps/dataset-search', component: DatasetSearch },
      { path: '/collections/:name/:pxd', component: { template: '<div/>' } },
    ],
  })
  router.push(url)
  await router.isReady()
  const w = mount(DatasetSearch, { global: { plugins: [router], stubs: { DatasetResultsTable: { props: ['datasets'], template: '<div class="rows">{{ (datasets || []).map(r => r.accession).join(",") }}</div>' } } } })
  await flushPromises()
  return { w, router }
}

describe('DatasetSearch view', () => {
  beforeEach(() => { apiGet.mockReset() })

  it('loads a deep-linked query once', async () => {
    backend(() => page('PXD1'))
    await mountAt('/apps/dataset-search?q=liver&organism=Homo%20sapiens')
    expect(datasetCalls()).toHaveLength(1)
    expect(datasetCalls()[0][2]).toMatchObject({ q: 'liver', organism: 'Homo sapiens', page: 1 })
  })

  it('does not repeat a search when its own URL update fires the route watcher', async () => {
    backend(() => page('PXD1'))
    const { w, router } = await mountAt('/apps/dataset-search')
    expect(datasetCalls()).toHaveLength(1)
    await w.find('input').setValue('kidney')
    await w.findAll('button').find((b) => b.text() === 'Search').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.q).toBe('kidney')
    expect(datasetCalls()).toHaveLength(2)
  })

  it('still reloads on back/forward navigation to a different query', async () => {
    backend(() => page('PXD1'))
    const { router } = await mountAt('/apps/dataset-search?q=a')
    await router.push('/apps/dataset-search?q=b')
    await flushPromises()
    expect(datasetCalls()).toHaveLength(2)
    expect(datasetCalls()[1][2].q).toBe('b')
  })

  it('keeps the newest page when an older request resolves last', async () => {
    let releaseOld
    backend((params) => params.q === 'old'
      ? new Promise((r) => { releaseOld = () => r({ datasets: [{ accession: 'OLDACC' }], total: 1 }) })
      : page('NEWACC'))
    const { w } = await mountAt('/apps/dataset-search?q=old')
    await w.find('input').setValue('new')
    await w.findAll('button').find((b) => b.text() === 'Search').trigger('click')
    await flushPromises()
    releaseOld()
    await flushPromises()
    expect(w.find('.rows').text()).toBe('NEWACC')
  })
})
