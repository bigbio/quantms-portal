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

  it('shows cell lines, diseases and tissues at the top when the collection has them', async () => {
    apiGet.mockImplementation((base, path) => {
      if (path.startsWith('/collections/')) {
        return Promise.resolve({ name: 'celllines', title: 'Human Cancer Cell Lines',
          stats: { datasets: 22, total_cell_lines: 1084, total_diseases: 245, total_tissues: 145, total_features: 10 } })
      }
      return Promise.resolve({ datasets: [], total: 22 })
    })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/collections/:name', component: CollectionDetail }] })
    router.push('/collections/celllines')
    await router.isReady()
    const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs } })
    await flushPromises()
    const labels = w.findAll('.col-stat .stat-label').map((n) => n.text())
    expect(labels.slice(0, 4)).toEqual(['Datasets', 'Cell lines', 'Diseases', 'Tissues'])
    expect(labels).toContain('Features')
  })

  it('omits the biological counts for collections without them', async () => {
    apiGet.mockImplementation((base, path) =>
      path.startsWith('/collections/')
        ? Promise.resolve({ name: 'msnet', stats: { datasets: 3, total_psms: 9 } })
        : Promise.resolve({ datasets: [], total: 3 }))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/collections/:name', component: CollectionDetail }] })
    router.push('/collections/msnet')
    await router.isReady()
    const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs } })
    await flushPromises()
    const labels = w.findAll('.col-stat .stat-label').map((n) => n.text())
    expect(labels).not.toContain('Cell lines')
    expect(labels).not.toContain('Tissues')
  })
})
