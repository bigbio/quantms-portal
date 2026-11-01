// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import QpxExplore from './QpxExplore.vue'

const overview = {
  accession: 'PXD1', phash: 'abc', files: { pg: ['x.pg.parquet'] },
  available_views: { feature: false, pg: true, psm: false, sample: false, run: true },
  row_counts: { pg: 3, run: 552 }, protein_groups: 2,
  organisms: [], organism_parts: [], instruments: [], acquisition_methods: [],
}

let searchDown = false

const CATALOGUE = [
  { accession: 'MSV000085836', title: 'CCLE', collection: 'celllines', collections: ['celllines'], organism: 'homo sapiens', instrument: 'Orbitrap Fusion', samples: 460, peptides: 300, dataset_ref: 'MSV000085836/hash1' },
  { accession: 'PXD048538', title: 'Gastric', collection: 'celllines', collections: ['celllines'], organism: 'homo sapiens', instrument: 'Q Exactive HF', samples: 42, peptides: 200, dataset_ref: 'PXD048538/hash1' },
  { accession: 'PXD2', title: 'Mouse brain', collection: 'msnet', collections: ['msnet'], organism: 'mus musculus', instrument: 'NT=timsTOF Pro;AC=MS:1003005', samples: 8, peptides: 100, dataset_ref: 'PXD2/hash2' },
]

function respond(url) {
  if (url.includes('dataset-search/datasets?') && searchDown) throw new TypeError('network down')
  if (url.includes('dataset-search/datasets?')) return { total: 3, total_pages: 1, datasets: CATALOGUE }
  const ds = url.match(/dataset-search\/datasets\/([^/?]+)$/)
  if (ds) return { accession: ds[1], dataset_ref: `${ds[1]}/hash1`, samples: 42 }
  if (url.includes('rest.uniprot.org')) return { results: [] }
  if (url.includes('/overview')) return overview
  if (url.includes('/runs')) return { runs: [{ run_file_name: 'r1' }] }
  if (url.includes('/proteins')) return { columns: ['anchor_protein', 'intensity'], rows: [['P1', 40]] }
  if (url.includes('/schema')) return { views: [] }
  if (url.includes('/ptms')) return { available: true, table: 'psm', source: 'modifications', columns: ['modification', 'n_psms', 'n_peptides', 'n_peptidoforms'], rows: [['Oxidation', 3, 2, 2]] }
  return {}
}

beforeEach(() => {
  searchDown = false
  global.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => respond(String(url)) }))
})
afterEach(() => { vi.restoreAllMocks() })

async function open(query) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/apps/qpx-explore', component: QpxExplore }, { path: '/:p(.*)*', component: { template: '<div/>' } }] })
  router.push({ path: '/apps/qpx-explore', query })
  await router.isReady()
  const w = mount(QpxExplore, { global: { plugins: [router] } })
  await flushPromises()
  w.router = router
  return w
}

const catalogueLoads = () => global.fetch.mock.calls.filter((c) => String(c[0]).includes('dataset-search/datasets?')).length

describe('QpxExplore', () => {
  it('lists the catalogue on the start page and opens a row in the explorer', async () => {
    const w = await open({})
    expect(w.findAll('.qc-row').map((r) => r.find('.qc-acc').text())).toEqual(['MSV000085836', 'PXD048538', 'PXD2'])
    // examples take their current version from the catalogue; one not in it is left out
    expect(w.findAll('.qc-start').map((b) => b.find('code').text())).toEqual(['MSV000085836', 'PXD048538'])
    expect(w.find('.qc-totals').text()).toContain('510samples')
    await w.findAll('.qc-row')[2].trigger('click')
    await flushPromises()
    expect(global.fetch.mock.calls.some((c) => String(c[0]).includes('/datasets/PXD2/hash2/overview'))).toBe(true)
  })

  it('filters the catalogue by a facet and by search', async () => {
    const w = await open({})
    const organisms = w.findAll('.qc-facet')[1]
    expect(organisms.findAll('.qc-opt').map((o) => o.text())).toEqual(['Homo sapiens2', 'Mus musculus1'])
    await organisms.findAll('.qc-opt')[1].trigger('click')
    expect(w.findAll('.qc-row')).toHaveLength(1)
    // instrument names are cleaned and the other facets count within the filter
    expect(w.findAll('.qc-facet')[2].findAll('.qc-opt').map((o) => o.text())).toEqual(['timsTOF Pro1'])
    await organisms.findAll('.qc-opt')[1].trigger('click')
    await w.find('.qc-search').setValue('gastric')
    expect(w.findAll('.qc-row').map((r) => r.find('.qc-acc').text())).toEqual(['PXD048538'])
  })

  it('retries the catalogue when it could not be loaded', async () => {
    searchDown = true
    const w = await open({})
    expect(w.text()).toContain('Could not load the dataset catalogue.')
    searchDown = false
    await w.find('.notice button').trigger('click')
    await flushPromises()
    expect(w.findAll('.qc-row')).toHaveLength(3)
  })

  it('does not load the catalogue when opened on a dataset', async () => {
    await open({ ref: 'PXD1/abc' })
    expect(catalogueLoads()).toBe(0)
  })

  it('returns to a working start page when the ref leaves the URL', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    await w.router.push({ path: '/apps/qpx-explore', query: {} })
    await flushPromises()
    expect(w.findAll('.qc-row')).toHaveLength(3)
    expect(w.find('.qx-card').exists()).toBe(false)
  })

  it('disables tabs whose table the dataset lacks', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    const tab = (label) => w.findAll('.qx-tab').find((b) => b.text() === label)
    expect(tab('Proteins').attributes('disabled')).toBeUndefined()
    expect(tab('Runs').attributes('disabled')).toBeUndefined()
    expect(tab('PSMs').attributes('disabled')).toBeDefined()
    expect(tab('PSMs').attributes('title')).toBe('This dataset has no psm table')
    expect(tab('Features').attributes('disabled')).toBeDefined()
  })

  it('enables PTMs from PSMs when the dataset has no feature table', async () => {
    overview.available_views.psm = true
    try {
      const w = await open({ ref: 'PXD1/abc', tab: 'ptms' })
      const tab = w.findAll('.qx-tab').find((b) => b.text() === 'PTMs')
      expect(tab.attributes('disabled')).toBeUndefined()
      expect(tab.classes()).toContain('active')
      expect(w.text()).toContain('counted over target PSMs')
      expect(w.find('.qt-table').text()).toContain('Oxidation')
      // features are not there to drill into
      expect(w.find('.qt-table .qx-link').exists()).toBe(false)
    } finally {
      overview.available_views.psm = false
    }
  })

  it('disables PTMs without a feature or PSM table', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    const tab = w.findAll('.qx-tab').find((b) => b.text() === 'PTMs')
    expect(tab.attributes('disabled')).toBeDefined()
    expect(tab.attributes('title')).toBe('This dataset has no feature or psm table')
  })

  it('counts protein groups and runs from the overview, not the loaded rows', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    const cards = Object.fromEntries(w.findAll('.qx-card').map((c) => [c.find('.qx-card-label').text(), c.find('.qx-card-val').text()]))
    expect(cards['Protein groups']).toBe('2')
    expect(cards.Runs).toBe('552')
  })

  it('falls back to the overview when a deep-linked tab is unavailable', async () => {
    const w = await open({ ref: 'PXD1/abc', tab: 'spectra' })
    expect(w.find('.qx-tab.active').text()).toBe('Overview')
  })

  it('opens the PSM tab from an old ?tab=spectra link', async () => {
    overview.available_views.psm = true
    try {
      const w = await open({ ref: 'PXD1/abc', tab: 'spectra' })
      expect(w.find('.qx-tab.active').text()).toBe('PSMs')
    } finally {
      overview.available_views.psm = false
    }
  })

  it('loads a tab only when it is opened, once', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    const urls = () => global.fetch.mock.calls.map((c) => String(c[0]))
    expect(urls().some((u) => u.includes('/proteins'))).toBe(false)
    // the overview colours its charts by sample annotation, so it loads the run table (the sample table is absent)
    expect(urls().filter((u) => u.includes('/runs')).length).toBe(1)
    expect(urls().some((u) => u.includes('/samples'))).toBe(false)
    const tab = (label) => w.findAll('.qx-tab').find((b) => b.text() === label)
    await tab('Proteins').trigger('click')
    await flushPromises()
    await tab('Overview').trigger('click')
    await tab('Proteins').trigger('click')
    await tab('Runs').trigger('click')
    await flushPromises()
    expect(urls().filter((u) => u.includes('/proteins')).length).toBe(1)
    expect(urls().filter((u) => u.includes('/runs')).length).toBe(1)
  })

  it('sends sort parameters when a protein column is clicked', async () => {
    const w = await open({ ref: 'PXD1/abc', tab: 'proteins' })
    await w.findAll('th button')[1].trigger('click')
    await flushPromises()
    const last = String(global.fetch.mock.calls.at(-1)[0])
    expect(last).toContain('/proteins')
    expect(last).toContain('sort=intensity')
  })
})
