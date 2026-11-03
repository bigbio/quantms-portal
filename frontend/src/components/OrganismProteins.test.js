// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import OrganismProteins from './OrganismProteins.vue'

const row = (organism, datasets, proteins) => ({ organism, datasets, proteins, peptides: 1 })
const STATS = {
  generated_at: '2026-11-03T00:40:14Z',
  species: [
    row('Homo sapiens', 191, 20446),
    row('Mus musculus', 8, 21015),
    row('Danio rerio', 2, 14231),
    row('Saccharomyces cerevisiae S288C', 1, 4883),
    row('Bacillus subtilis; Escherichia coli K24', 1, 21988),
    row('Gossypium hirsutum', 1, 33562),
    row('Drosophila', 1, 9051),
    row('Drosophila melanogaster', 1, 3062),
  ],
}

describe('OrganismProteins', () => {
  it('shows the model organisms present, in a fixed order, skipping mixtures and others', () => {
    const w = mount(OrganismProteins, { props: { stats: STATS } })
    expect(w.findAll('.bar-name').map((n) => n.text())).toEqual(['Homo sapiens', 'Mus musculus', 'Saccharomyces cerevisiae'])
    expect(w.findAll('.bar-value').map((n) => n.text())).toEqual(['20.4K', '21K', '4.9K'])
  })

  it('says so when the loaded index has none of the organisms, instead of loading forever', () => {
    const w = mount(OrganismProteins, {
      props: { stats: { species: [row('Gossypium hirsutum', 1, 33562)] } },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(w.find('.bars').exists()).toBe(false)
    expect(w.find('.fig-empty').text()).toContain('None of these organisms')
  })
})
