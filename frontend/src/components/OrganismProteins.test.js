// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OrganismProteins from './OrganismProteins.vue'

const row = (organism, datasets, proteins) => ({ organism, datasets, proteins, peptides: 1 })
// stats.json order: most datasets first.
const STATS = {
  generated_at: '2026-11-03T00:40:14Z',
  species: [
    row('Homo sapiens', 191, 20446),
    row('Mus musculus', 8, 21015),
    row('Danio rerio', 2, 14231),
    row('Arabidopsis thaliana', 1, 14742),
    row('Bacillus subtilis; Phage M13; Escherichia coli K24', 1, 21988),
    row('Gossypium hirsutum', 1, 33562),
  ],
}

describe('OrganismProteins', () => {
  it('shows the most-studied organisms, not the largest proteomes, and names mixtures', () => {
    const names = mount(OrganismProteins, { props: { stats: STATS } }).findAll('.bar-name').map((n) => n.text())
    expect(names).toEqual(['Homo sapiens', 'Mus musculus', 'Danio rerio', 'Arabidopsis thaliana', 'Mixed (3 organisms)'])
  })
})
