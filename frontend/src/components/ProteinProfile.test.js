// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import ProteinProfile from './ProteinProfile.vue'
import { resetPeptideStatsCache } from '../utils/peptideStats.js'

let mapMounts = 0
const stubs = {
  ProteinSequenceMap: { props: ['accession'], template: '<div class="seqmap" />', mounted() { mapMounts++ } },
}
const profileFor = (acc, n) => ({
  query: acc,
  accession: acc,
  primary_accession: acc,
  gene: 'TP53',
  n_datasets: n,
  n_peptides: 10,
  observations: { by_tissue: [], by_disease: [], by_species: [] },
})

describe('ProteinProfile', () => {
  beforeEach(() => {
    mapMounts = 0
    resetPeptideStatsCache()
    apiGet.mockReset()
    apiGet.mockImplementation((base, path, params) => {
      if (path === '/stats') return Promise.resolve({ obs_distribution: { bins: [], n: 0 } })
      if (path === '/protein/profile') return Promise.resolve(profileFor(params.accession, params.gpp_min ? 5 : 9))
      return Promise.resolve({})
    })
  })

  it('refreshes in place when only the GPP cutoff changes', async () => {
    const w = mount(ProteinProfile, { props: { accession: 'P04637', gppMin: null }, global: { stubs } })
    await flushPromises()
    expect(w.find('.seqmap').exists()).toBe(true)
    expect(mapMounts).toBe(1)

    await w.setProps({ gppMin: 0.5 })
    expect(w.text()).not.toContain('Building biological profile')
    await flushPromises()
    const profileCalls = apiGet.mock.calls.filter((c) => c[1] === '/protein/profile')
    expect(profileCalls).toHaveLength(2)
    expect(profileCalls[1][2]).toMatchObject({ accession: 'P04637', gpp_min: 0.5 })
    expect(mapMounts).toBe(1)
  })

  it('fetches the shared /stats document once across instances', async () => {
    mount(ProteinProfile, { props: { accession: 'P04637' }, global: { stubs } })
    mount(ProteinProfile, { props: { accession: 'P69905' }, global: { stubs } })
    await flushPromises()
    expect(apiGet.mock.calls.filter((c) => c[1] === '/stats')).toHaveLength(1)
  })
})
