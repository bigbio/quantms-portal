// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import CollectionDetail from './CollectionDetail.vue'

const stubs = {
  DatasetResultsTable: { props: ['datasets'], template: '<div class="rows">{{ (datasets || []).map(d => d.accession).join(",") }}</div>' },
}

describe('CollectionDetail view', () => {
  it('ignores a slow response for the previous collection', async () => {
    let releaseOld
    apiGet.mockImplementation((base, path, params) => {
      if (path.startsWith('/collections/')) return Promise.resolve({ name: path.split('/').pop(), stats: {} })
      if (params?.collection === 'old') {
        return new Promise((r) => { releaseOld = () => r({ datasets: [{ accession: 'OLDACC' }], total: 1 }) })
      }
      return Promise.resolve({ datasets: [{ accession: 'NEWACC' }], total: 1 })
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/collections/:name', component: CollectionDetail }],
    })
    router.push('/collections/old')
    await router.isReady()
    const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs } })
    await flushPromises()

    await router.push('/collections/new')
    await flushPromises()
    releaseOld()
    await flushPromises()
    expect(w.find('.rows').text()).toBe('NEWACC')
  })
})
