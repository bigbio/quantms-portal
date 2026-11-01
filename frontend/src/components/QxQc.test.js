// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QxRunQc from './QxRunQc.vue'
import QxSampleIntensity from './QxSampleIntensity.vue'

const RUNS = {
  available: true, baseline: 'same fraction', robust_z: 3.5, n_flagged: 1,
  columns: ['run', 'plex', 'fraction', 'n_features', 'median_mass_error_ppm'],
  rows: [
    { run: 'r1', plex: 1, fraction: '1', n_features: 100, median_mass_error_ppm: 0.5, flags: [] },
    { run: 'r2', plex: 2, fraction: '1', n_features: 98, median_mass_error_ppm: 9.8,
      flags: [{ metric: 'median_mass_error_ppm', z: 10.2, direction: 'high' }] },
  ],
}
const SAMPLES = {
  available: true, robust_z: 3.5, n_flagged: 1, n_plexes: 2,
  rows: [
    { sample: 'S1', plex: 1, label: 'L1', n_proteins: 50, q05: 5, q25: 5.5, median: 6, q75: 6.5, q95: 7, reference: false, flags: [] },
    { sample: 'S2', plex: 1, label: 'L2', n_proteins: 50, q05: 2, q25: 2.5, median: 3, q75: 3.5, q95: 4, reference: false,
      flags: [{ metric: 'median', z: -4.8, direction: 'low' }] },
    { sample: 'S3', plex: 2, label: 'L1', n_proteins: 50, q05: 5, q25: 5.6, median: 6.2, q75: 6.6, q95: 7, reference: true, flags: [] },
  ],
}

beforeEach(() => {
  global.fetch = vi.fn(async (url) => ({
    ok: true, status: 200, json: async () => (String(url).endsWith('/qc/runs') ? RUNS : SAMPLES),
  }))
})
afterEach(() => { vi.restoreAllMocks() })

describe('QxRunQc', () => {
  it('summarises, highlights flagged values and filters to flagged runs', async () => {
    const w = mount(QxRunQc, { props: { datasetRef: 'PXD1/abc' } })
    await flushPromises()
    expect(w.text()).toContain('1 of 2 runs flagged')
    expect(w.text()).toContain('far from runs of the same fraction')
    // one plex per run and a single fraction: both columns say nothing, so they are hidden
    const heads = w.findAll('th').map((h) => h.text())
    expect(heads.some((h) => h.startsWith('plex'))).toBe(false)
    expect(heads.some((h) => h.startsWith('fraction'))).toBe(false)
    const flagged = w.find('.rq-flag')
    expect(flagged.text()).toContain('⚠')
    expect(flagged.attributes('title')).toBe('Mass error (ppm) is high (robust z 10.2)')
    expect(w.findAll('tbody tr')).toHaveLength(2)
    await w.find('input[type="checkbox"]').setValue(true)
    expect(w.findAll('tbody tr')).toHaveLength(1)
  })
})

describe('QxSampleIntensity', () => {
  it('draws one box per sample, a marker per flagged sample, references in grey', async () => {
    const w = mount(QxSampleIntensity, { props: { datasetRef: 'PXD1/abc' } })
    await flushPromises()
    expect(w.findAll('.si-box')).toHaveLength(3)
    expect(w.findAll('.si-flag')).toHaveLength(1)
    expect(w.findAll('.si-box.ref')).toHaveLength(1)
    expect(w.text()).toContain('▼ 1 flagged')
    await w.findAll('.si-hit')[1].trigger('mouseenter')
    expect(w.find('.si-tip').text()).toContain('median intensity low (robust z -4.8)')
  })

  it('offers the numbers as a table', async () => {
    const w = mount(QxSampleIntensity, { props: { datasetRef: 'PXD1/abc' } })
    await flushPromises()
    await w.find('input[type="checkbox"]').setValue(true)
    expect(w.findAll('tbody tr')).toHaveLength(3)
  })
})
