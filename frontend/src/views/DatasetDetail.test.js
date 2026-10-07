// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import DatasetDetail from './DatasetDetail.vue'
import { _clearEvaluationCache } from '../utils/evaluation.js'

const stubs = { DatasetPanel: { props: ['dataset'], template: '<div class="panel">{{ dataset.title }}</div>' } }

describe('DatasetDetail view', () => {
  it('shows the dataset of the current route when an older request resolves last', async () => {
    let releaseOld
    apiGet.mockImplementation((base, path) => path.endsWith('/PXDOLD')
      ? new Promise((r) => { releaseOld = () => r({ accession: 'PXDOLD', title: 'Old dataset' }) })
      : Promise.resolve({ accession: 'PXDNEW', title: 'New dataset' }))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/collections/:name/:pxd', component: DatasetDetail }],
    })
    router.push('/collections/msnet/PXDOLD')
    await router.isReady()
    const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs } })
    await flushPromises()

    await router.push('/collections/msnet/PXDNEW')
    await flushPromises()
    releaseOld()
    await flushPromises()
    expect(w.text()).toContain('New dataset')
    expect(w.text()).not.toContain('Old dataset')
  })

  it('encodes the accession in the request path', async () => {
    apiGet.mockReset()
    apiGet.mockResolvedValue({ accession: 'X', title: 'X' })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/collections/:name/:pxd', component: DatasetDetail }] })
    router.push('/collections/msnet/' + encodeURIComponent('A B?x'))
    await router.isReady()
    mount({ template: '<router-view />' }, { global: { plugins: [router], stubs } })
    await flushPromises()
    expect(apiGet.mock.calls[0][1]).toBe('/datasets/A%20B%3Fx')
  })

  it('loads a specific version and lists every version', async () => {
    _clearEvaluationCache()
    apiGet.mockReset()
    apiGet.mockImplementation((base, path) => path.startsWith('/datasets/')
      ? Promise.resolve({ accession: 'PXD9', title: 'T', collection: 'msnet', dataset_ref: 'PXD9/bbb',
        versions: [{ dataset_ref: 'PXD9/aaa', organism: 'Danio rerio' }, { dataset_ref: 'PXD9/bbb', organism: 'Fusobacterium' }] })
      : Promise.reject(Object.assign(new Error('nf'), { status: 404 })))
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/collections/:name/:pxd', component: DatasetDetail },
      { path: '/collections/:name/:pxd/:hash', component: DatasetDetail }] })
    router.push('/collections/msnet/PXD9/bbb')
    await router.isReady()
    const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs } })
    await flushPromises()
    expect(apiGet.mock.calls[0][1]).toBe('/datasets/PXD9/bbb')
    const links = w.findAll('.version-link')
    expect(links.map((l) => l.attributes('href'))).toEqual(['/collections/msnet/PXD9/aaa', '/collections/msnet/PXD9/bbb'])
    expect(w.find('.version-link.current').text()).toContain('Fusobacterium')
  })

  describe('evaluation badge', () => {
    const rec = { verdict: 'PASS', dimensions: { ms: 'PASS', biology: 'WARN', metadata: 'NA' }, override: null, evaluator_version: '1', checks: [] }
    async function mountWith(evalImpl) {
      _clearEvaluationCache()
      apiGet.mockReset()
      apiGet.mockImplementation((base, path) => path.startsWith('/datasets/')
        ? Promise.resolve({ accession: 'PXD1', title: 'T', dataset_ref: 'PXD1/abc' })
        : evalImpl(path))
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/collections/:name/:pxd', component: DatasetDetail }] })
      router.push('/collections/msnet/PXD1')
      await router.isReady()
      const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs } })
      await flushPromises()
      return w
    }
    it('renders the badge when a record exists', async () => {
      const w = await mountWith(() => Promise.resolve(rec))
      expect(apiGet.mock.calls[1][1]).toBe('/quantms/evaluations/PXD1/abc/evaluation.json')
      expect(w.findAll('.eval-chip').map((c) => c.text())).toEqual(['MS PASS', 'Biology WARN', 'Metadata NA'])
    })
    it('renders nothing on 404', async () => {
      const w = await mountWith(() => Promise.reject(Object.assign(new Error('nf'), { status: 404 })))
      expect(w.find('.eval-badge').exists()).toBe(false)
      expect(w.text()).not.toContain('unavailable')
    })
  })
})
