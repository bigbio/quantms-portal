// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import ProteomeCompass from './ProteomeCompass.vue'

const stubs = {
  CompassProteinCard: { props: ['profile'], template: '<div class="card">{{ profile.uniprot_acc }}</div>' },
  GapTable: true,
  CompassLinks: true,
}
const calls = (prefix) => apiGet.mock.calls.filter((c) => c[1].startsWith(prefix))

async function mountAt(url) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/apps/compass', component: ProteomeCompass }],
  })
  router.push(url)
  await router.isReady()
  const w = mount(ProteomeCompass, { global: { plugins: [router], stubs } })
  await flushPromises()
  return { w, router }
}

describe('ProteomeCompass view', () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiGet.mockImplementation((base, path) => {
      if (path.startsWith('/profile/')) return Promise.resolve({ uniprot_acc: path.split('/').pop() })
      if (path === '/query/facet') return Promise.resolve({ rows: [], count: 0 })
      return Promise.resolve({})
    })
  })

  it('fetches a deep-linked profile once', async () => {
    const { w, router } = await mountAt('/apps/compass?acc=P04637')
    await flushPromises()
    expect(calls('/profile/')).toHaveLength(1)
    expect(router.currentRoute.value.query).toEqual({ mode: 'protein', acc: 'P04637' })
    expect(w.find('.card').text()).toBe('P04637')
  })

  it('fetches a typed lookup once even though it rewrites the URL', async () => {
    const { w, router } = await mountAt('/apps/compass')
    await w.find('input[aria-label="UniProt accession"]').setValue('p69905')
    await w.find('button.btn').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.acc).toBe('P69905')
    expect(calls('/profile/')).toHaveLength(1)
  })

  it('does not request unused facets for the explorer', async () => {
    await mountAt('/apps/compass?mode=explore&preset=dark')
    expect(calls('/facets')).toHaveLength(0)
    expect(calls('/query/facet')).toHaveLength(1)
  })

  it('keeps the newest profile when an older lookup resolves last', async () => {
    let releaseOld
    apiGet.mockImplementation((base, path) => path === '/profile/OLD1'
      ? new Promise((r) => { releaseOld = () => r({ uniprot_acc: 'OLD1' }) })
      : Promise.resolve({ uniprot_acc: 'NEW1' }))
    const { w } = await mountAt('/apps/compass?acc=OLD1')
    await w.find('input[aria-label="UniProt accession"]').setValue('NEW1')
    await w.find('button.btn').trigger('click')
    await flushPromises()
    releaseOld()
    await flushPromises()
    expect(w.find('.card').text()).toBe('NEW1')
  })

  it('retries a failed view from the error banner', async () => {
    apiGet.mockRejectedValueOnce(new Error('down'))
    const { w } = await mountAt('/apps/compass?mode=proteomes')
    expect(w.text()).toContain('Could not load the proteomes scoreboard')
    apiGet.mockResolvedValueOnce({ organisms: [] })
    await w.find('.cc-retry').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Could not load the proteomes scoreboard')
    expect(calls('/organisms')).toHaveLength(2)
  })
})
