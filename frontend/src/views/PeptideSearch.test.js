// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import PeptideSearch from './PeptideSearch.vue'
import { resetPeptideStatsCache } from '../utils/peptideStats.js'

const stubs = { PeptideProfile: true, ProteinProfile: { props: ['accession', 'gppMin'], template: '<div class="pprof">{{ accession }}|{{ gppMin }}</div>' } }

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


const searchCalls = () => apiGet.mock.calls.filter((c) => c[1].startsWith('/search/'))
const ok = (tag) => Promise.resolve({ total_datasets: 1, datasets: [{ dataset_ref: tag, dataset_accession: tag, collection: 'msnet' }] })

describe('PeptideSearch view', () => {
  beforeEach(() => {
    apiGet.mockReset()
    resetPeptideStatsCache()
    vi.useRealTimers()
  })

  it('renders an empty result instead of crashing when the response has no datasets', async () => {
    backend(() => Promise.resolve({ total_datasets: 0 }))
    const { w } = await mountAt('/apps/peptide-search?sequence=PEPTIDEK')
    expect(w.text()).toContain('No datasets match.')
    expect(w.text()).not.toContain('temporarily unavailable')
  })

  it('sends a deep-linked search exactly once, including the GPP filter', async () => {
    backend(() => ok('PXD1'))
    await mountAt('/apps/peptide-search?sequence=PEPTIDEK&gpp_min=0.4')
    await flushPromises()
    expect(searchCalls()).toHaveLength(1)
    expect(searchCalls()[0][2]).toMatchObject({ sequence: 'PEPTIDEK', gpp_min: 0.4 })
  })

  it('does not re-send a search when its own URL update fires the route watcher', async () => {
    backend(() => ok('PXD1'))
    const { w, router } = await mountAt('/apps/peptide-search')
    await w.find('input.search-input, input[type="text"], input').setValue('PEPTIDEK')
    const btn = w.findAll('button').find((b) => b.text() === 'Search')
    await btn.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.sequence).toBe('PEPTIDEK')
    expect(searchCalls()).toHaveLength(1)

    // An explicit second click still re-runs the search.
    await btn.trigger('click')
    await flushPromises()
    expect(searchCalls()).toHaveLength(2)
  })

  it('keeps the newest results when an older search resolves last', async () => {
    let releaseOld
    backend((path, params) => params.sequence === 'OLDPEPK'
      ? new Promise((r) => { releaseOld = () => r({ total_datasets: 1, datasets: [{ dataset_ref: 'OLD', dataset_accession: 'PXDOLD', collection: 'msnet' }] }) })
      : ok('PXDNEW'))
    const { w } = await mountAt('/apps/peptide-search?sequence=OLDPEPK')
    const input = w.find('input')
    await input.setValue('NEWPEPK')
    await w.findAll('button').find((b) => b.text() === 'Search').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('PXDNEW')

    releaseOld()
    await flushPromises()
    expect(w.text()).toContain('PXDNEW')
    expect(w.text()).not.toContain('PXDOLD')
  })

  it('passes the GPP cutoff to the protein profile only after the slider settles', async () => {
    backend(() => ok('PXD1'))
    const { w } = await mountAt('/apps/peptide-search?mode=protein&query=P04637&gpp_min=0.3')
    expect(w.find('.pprof').text()).toBe('P04637|0.3')

    vi.useFakeTimers()
    const slider = w.find('input[type="range"]')
    expect(slider.exists()).toBe(true)
    for (const v of ['0.31', '0.32', '0.33']) await slider.setValue(v)
    expect(w.find('.pprof').text()).toBe('P04637|0.3')
    vi.advanceTimersByTime(250)
    await w.vm.$nextTick()
    expect(w.find('.pprof').text()).toBe('P04637|0.33')
    vi.useRealTimers()
  })

  it('lists a protein per peptide, in sequence order, with the datasets on a second tab', async () => {
    backend(() => ok('PXD1'))
    const base = apiGet.getMockImplementation()
    const pep = (sequence, start, extra) => ({
      sequence, start, end: start && start + sequence.length - 1, n_occurrences: start ? 1 : 0,
      proteotypic: true, n_datasets: 2, n_obs: 10, n_peptidoforms: 1, peptidoforms: [{ peptidoform: sequence, n_obs: 10 }], ...extra,
    })
    apiGet.mockImplementation((b, path, params) => path === '/protein/peptides'
      ? Promise.resolve({ found: true, peptides: [
        pep('ISOFORMK', null),
        pep('VPTANVSVVDLTCR', 230, { proteotypic: false, n_peptidoforms: 4,
          peptidoforms: [{ peptidoform: 'VPTANVSVVDLTC(Carbamidomethyl)R', n_obs: 9 }] }),
        pep('LVINGNPITIFQER', 67),
      ] })
      : base(b, path, params))
    const { w } = await mountAt('/apps/peptide-search?mode=protein&query=P04406')
    const rows = w.findAll('.pp-peptides tbody tr')
    expect(rows.map((r) => r.find('.pp-seq').text())).toEqual(['LVINGNPITIFQER', 'VPTANVSVVDLTCR', 'ISOFORMK'])
    expect(rows[1].text()).toContain('230–243')
    expect(rows[1].text()).toContain('shared')
    expect(rows[1].find('.pf-mod').text()).toBe('C')
    expect(rows[1].text()).toContain('+3')
    expect(w.find('.pp-peptides').text()).toContain('3 peptides, 2 unique to the gene')
    expect(w.text()).not.toContain('dataset match')

    await w.findAll('.pp-tabs button')[1].trigger('click')
    expect(w.find('.pp-peptides').isVisible()).toBe(false)
    expect(w.text()).toContain('1 dataset match')
  })

  it('falls back to the dataset table when the protein has no peptide list', async () => {
    backend(() => ok('PXD1'))
    const { w } = await mountAt('/apps/peptide-search?mode=protein&query=P04406')
    expect(w.find('.pp-tabs').exists()).toBe(false)
    expect(w.find('.pp-peptides').exists()).toBe(false)
    expect(w.text()).toContain('1 dataset match')
  })

  it('upper-cases the typed sequence via a class, not the placeholder', async () => {
    backend(() => ok('PXD1'))
    const { w } = await mountAt('/apps/peptide-search')
    const input = w.find('input[aria-label="Peptide sequence"]')
    expect(input.classes()).toEqual(expect.arrayContaining(['ps-query', 'ps-seq']))
    expect(input.attributes('style') || '').not.toContain('text-transform')
  })
})
