// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (base, path) => {
    if (path === '/protein/profile') {
      return {
        accession: 'P04637', primary_accession: 'P04637', n_datasets: 1,
        species: [{ value: 'homo sapiens', n_datasets: 59, n_observations: 10 }],
        observations: { by_tissue: [], by_disease: [], by_species: [] },
      }
    }
    return {}
  }),
}))
import ProteinProfile from './ProteinProfile.vue'
import DatasetPanel from './DatasetPanel.vue'

describe('organism icon chips', () => {
  it('renders the species icon as a separate element from its label', async () => {
    const w = mount(ProteinProfile, { props: { accession: 'P04637' }, global: { stubs: { ProteinSequenceMap: true } } })
    await flushPromises()
    const chip = w.findAll('.pp-count-chip').find((c) => c.text().includes('homo sapiens'))
    expect(chip).toBeTruthy()
    expect(chip.find('.chip-icon').text()).toBe('🧬')
    expect(chip.element.innerHTML).not.toContain('🧬homo')
  })

  it('does the same on the dataset panel', () => {
    const w = mount(DatasetPanel, {
      props: { dataset: { accession: 'PXD1', organism: 'Homo sapiens', instrument: 'Q Exactive' } },
      global: { stubs: { CiteCredit: true, QualityBadges: true, 'router-link': true } },
    })
    const org = w.find('.ds-organism')
    expect(org.find('.chip-icon').text()).toBe('🧬')
    expect(org.text()).toContain('Homo sapiens')
  })
})
