// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import PeptideSearch from './PeptideSearch.vue'

const stubs = { PeptideProfile: true, ProteinProfile: true }

// Default backend: best-effort endpoints answer, searches answer via `search`.
function backend(search) {
  apiGet.mockImplementation((base, path, params) => {
    if (path === '/facets') return Promise.resolve({})
    if (path === '/stats') return Promise.resolve({ gpp: { default_min: 0.15 } })
    if (path === '/modifications') return Promise.resolve({ modifications: [] })
    if (path.startsWith('/search/')) return search(path, params)
    return Promise.resolve({})
  })
}

async function mountAt(url) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/apps/peptide-search', component: PeptideSearch }],
  })
  router.push(url)
  await router.isReady()
  const w = mount(PeptideSearch, { global: { plugins: [router], stubs } })
  await flushPromises()
  return { w, router }
}


describe('PeptideSearch view', () => {
  beforeEach(() => { apiGet.mockReset() })

  it('renders an empty result instead of crashing when the response has no datasets', async () => {
    backend(() => Promise.resolve({ total_datasets: 0 }))
    const { w } = await mountAt('/apps/peptide-search?sequence=PEPTIDEK')
    expect(w.text()).toContain('No datasets match.')
    expect(w.text()).not.toContain('temporarily unavailable')
  })
})
