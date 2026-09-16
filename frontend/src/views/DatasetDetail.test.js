// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import DatasetDetail from './DatasetDetail.vue'

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
})
