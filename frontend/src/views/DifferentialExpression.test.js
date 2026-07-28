// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('chart.js', () => {
  class Chart { constructor() {} update() {} destroy() {} }
  Chart.register = () => {}
  return {
    Chart,
    ScatterController: {}, PointElement: {},
    BarController: {}, BarElement: {}, DoughnutController: {}, ArcElement: {},
    CategoryScale: {}, LinearScale: {}, Tooltip: {}, Legend: {},
  }
})

const design = {
  factors: [{ name: 'compound', levels: ['DMSO', 'Pom', 'Len'] }],
  contrasts: [
    { id: 'DMSO__vs__Pom', group_a: 'DMSO', group_b: 'Pom', factor: 'compound' },
    { id: 'DMSO__vs__Len', group_a: 'DMSO', group_b: 'Len', factor: 'compound' },
  ],
}
const defaultResult = {
  rows: [
    { protein: 'P1', gene: 'G1', log2fc: 2, pvalue: 0.001, adj_pvalue: 0.01, n_peptides: 3, mean_group_a: 1, mean_group_b: 3, significant: true },
    { protein: 'P2', gene: 'G2', log2fc: -0.2, pvalue: 0.5, adj_pvalue: 0.8, n_peptides: 2, mean_group_a: 2, mean_group_b: 1.8, significant: false },
  ],
  count: 2,
  contrast: 'DMSO__vs__Pom',
}
const qcResult = {
  pca: [{ sample: 's1', pc1: 1, pc2: 2, group: 'DMSO' }, { sample: 's2', pc1: -1, pc2: 0, group: 'Pom' }],
  norm: { method: 'median' },
}

vi.mock('../de.js', () => ({
  listDatasets: vi.fn(async () => ({
    datasets: [{ ref: 'PXD1/h', accession: 'PXD1', title: 't', organism: 'Homo sapiens', n_samples: 4, factors: ['compound'] }],
    count: 1,
  })),
  getDesign: vi.fn(async () => design),
  getDefault: vi.fn(async () => defaultResult),
  getQc: vi.fn(async () => qcResult),
  runDe: vi.fn(async () => defaultResult),
}))

import DifferentialExpression from './DifferentialExpression.vue'
import { listDatasets, getDesign, getDefault, getQc, runDe } from '../de.js'

describe('DifferentialExpression view', () => {
  it('loads datasets and renders the picker', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    expect(listDatasets).toHaveBeenCalled()
    expect(w.text()).toContain('t')
    expect(w.text()).toContain('PXD1')
  })

  it('selecting a dataset syncs the ref into the URL', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    await w.find('.de-row').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.ref).toBe('PXD1/h')
    expect(w.text()).toContain('Selected dataset')
  })

  it('wires the full three-stage flow: design -> default run -> volcano/table/heatmap/qc/boxplot', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    await w.find('.de-row').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(getDesign).toHaveBeenCalledWith('PXD1/h')
    expect(getQc).toHaveBeenCalledWith('PXD1/h')
    // Default config (limma/median/protein) -> the precomputed default, not an on-demand run.
    expect(getDefault).toHaveBeenCalledWith('PXD1/h', 'DMSO__vs__Pom')
    expect(runDe).not.toHaveBeenCalled()

    expect(w.text()).toContain('P1')
    expect(w.text()).toContain('P2')

    // Before any protein is selected, the boxplot shows its placeholder.
    expect(w.text()).toContain('Select a protein')

    // Clicking a results-table row drives the shared selection into the boxplot.
    const row = w.findAll('tr').find((r) => r.text().includes('P1'))
    await row.trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Select a protein')
  })

  it('always loads the precomputed default (never an on-demand custom-method run) on a contrast change', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    await w.find('.de-row').trigger('click')
    await flushPromises()
    await flushPromises()
    getDefault.mockClear()

    // Switching contrast fetches that contrast's precomputed default; the UI
    // never calls the on-demand custom-method endpoint (method is fixed).
    await w.get('#de-contrast').setValue('DMSO__vs__Len')
    await flushPromises()

    expect(getDefault).toHaveBeenCalledWith('PXD1/h', 'DMSO__vs__Len')
    expect(runDe).not.toHaveBeenCalled()
  })

  it('drops a stale response when a newer contrast change resolves first', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    await w.find('.de-row').trigger('click')
    await flushPromises()
    await flushPromises()

    // Key slow/fast on the contrast argument (robust against any echo re-emits):
    // the Len fetch hangs, the Pom fetch resolves immediately with distinct rows.
    let resolveSlow
    const fastResult = { rows: [{ protein: 'FAST', gene: 'GF', log2fc: 1, pvalue: 0.01, adj_pvalue: 0.02, n_peptides: 1, mean_group_a: 1, mean_group_b: 2, significant: true }], count: 1, contrast: 'DMSO__vs__Pom' }
    getDefault.mockImplementation((ref, contrastId) =>
      contrastId === 'DMSO__vs__Len'
        ? new Promise((resolve) => { resolveSlow = () => resolve(defaultResult) })
        : Promise.resolve(fastResult))

    // Switch to Len (slow, hangs); let the URL/router settle so the later
    // switch isn't reordered by an in-flight route update.
    await w.get('#de-contrast').setValue('DMSO__vs__Len')
    await flushPromises()
    // Now switch back to Pom (fast) — this is the newest request and must win
    // even though the Len request is still in flight.
    await w.get('#de-contrast').setValue('DMSO__vs__Pom')
    await flushPromises()

    // The latest (Pom, fast) response is shown.
    expect(w.text()).toContain('FAST')

    // Now resolve the stale first (Len) request — it must NOT clobber the fast
    // result, because its sequence number is no longer the latest.
    resolveSlow()
    await flushPromises()
    expect(w.text()).toContain('FAST')
    expect(w.text()).not.toContain('P1')
  })

  it('links to the dataset page in the portal (not PRIDE), and shows no method selector', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: DifferentialExpression },
        { path: '/collections/:name/:pxd', component: { template: '<div/>' } },
      ],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()
    await w.find('.de-row').trigger('click')
    await flushPromises()
    await flushPromises()

    const link = w.get('.de-note a')
    expect(link.attributes('href')).toBe('/collections/differential-expression/PXD1')
    // The method/normalization/level selectors are gone from the UI.
    expect(w.find('#de-method').exists()).toBe(false)
    expect(runDe).not.toHaveBeenCalled()
  })

  it('does not refetch the datasets list on every query change (only design/qc/results)', async () => {
    listDatasets.mockClear()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()
    expect(listDatasets).toHaveBeenCalledTimes(1)

    // Selecting a dataset changes the URL (?ref=...) — the picker must still
    // work, and design/qc load for the newly-selected ref...
    await w.find('.de-row').trigger('click')
    await flushPromises()
    await flushPromises()
    expect(getDesign).toHaveBeenCalledWith('PXD1/h')
    expect(getQc).toHaveBeenCalledWith('PXD1/h')
    // ...but the datasets list itself is not refetched.
    expect(listDatasets).toHaveBeenCalledTimes(1)

    // A further query-only change (contrast/method/norm/level, same ref) via
    // a programmatic URL push (simulating browser Back/Forward) must still
    // not refetch the datasets list.
    getDesign.mockClear()
    getQc.mockClear()
    await router.push({ query: { ...router.currentRoute.value.query, method: 'deqms' } })
    await flushPromises()
    await flushPromises()
    expect(listDatasets).toHaveBeenCalledTimes(1)
  })

  it('surfaces a load error (with retry) when the default result fetch fails', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    getDefault.mockRejectedValueOnce(new Error('boom'))
    await w.find('.de-row').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(w.text()).toContain('Could not load the differential expression result')
  })
})
