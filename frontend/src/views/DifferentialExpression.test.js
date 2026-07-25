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
  factors: [{ name: 'compound', levels: ['DMSO', 'Pom'] }],
  contrasts: [{ id: 'DMSO__vs__Pom', group_a: 'DMSO', group_b: 'Pom', factor: 'compound' }],
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

    await w.find('tr.de-row').trigger('click')
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

    await w.find('tr.de-row').trigger('click')
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

  it('runs on-demand (not the default) when the config diverges from limma/median/protein', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    await w.find('tr.de-row').trigger('click')
    await flushPromises()
    await flushPromises()
    getDefault.mockClear()

    await w.get('#de-method').setValue('deqms')
    await flushPromises()

    expect(runDe).toHaveBeenCalledWith('PXD1/h', {
      contrast: 'DMSO__vs__Pom', method: 'deqms', normalization: 'median', level: 'protein',
    })
    expect(getDefault).not.toHaveBeenCalled()
  })

  it('drops a stale response when a newer config change resolves first', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    await w.find('tr.de-row').trigger('click')
    await flushPromises()
    await flushPromises()

    // First (slow) request: never resolves within this test.
    let resolveSlow
    runDe.mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve }))
    // Second (fast) request: resolves immediately with distinct rows.
    const fastResult = { rows: [{ protein: 'FAST', gene: 'GF', log2fc: 1, pvalue: 0.01, adj_pvalue: 0.02, n_peptides: 1, mean_group_a: 1, mean_group_b: 2, significant: true }], count: 1, contrast: 'DMSO__vs__Pom' }
    runDe.mockImplementationOnce(async () => fastResult)

    await w.get('#de-method').setValue('deqms')
    await w.get('#de-normalization').setValue('quantile')
    await flushPromises()

    // The fast (second) response should win and `running` should have settled.
    expect(w.text()).toContain('FAST')
    expect(w.text()).not.toContain('Running differential expression')

    // Now resolve the stale first request — it must NOT clobber the fast result.
    resolveSlow(defaultResult)
    await flushPromises()
    expect(w.text()).toContain('FAST')
    expect(w.text()).not.toContain('P1')
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
    await w.find('tr.de-row').trigger('click')
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

  it('shows a size-gate message and falls back to the default on a 413, and a config message on a 422', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DifferentialExpression }],
    })
    router.push('/')
    await router.isReady()

    const w = mount(DifferentialExpression, { global: { plugins: [router] } })
    await flushPromises()

    await w.find('tr.de-row').trigger('click')
    await flushPromises()
    await flushPromises()

    // Diverge from the default config so the next config change goes through
    // runDe (not getDefault).
    const err413 = new Error('too large')
    err413.status = 413
    runDe.mockRejectedValueOnce(err413)
    getDefault.mockClear()

    await w.get('#de-method').setValue('deqms')
    await flushPromises()

    expect(w.text()).toContain('Dataset too large for on-demand analysis')
    // Falls back to the precomputed default for the current contrast.
    expect(getDefault).toHaveBeenCalledWith('PXD1/h', 'DMSO__vs__Pom')
    expect(w.text()).toContain('P1')

    const err422 = new Error('bad config')
    err422.status = 422
    runDe.mockRejectedValueOnce(err422)

    await w.get('#de-normalization').setValue('quantile')
    await flushPromises()

    expect(w.text()).toContain('Invalid analysis configuration')
  })
})
