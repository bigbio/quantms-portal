// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (base, path) => {
    if (path === '/collections') {
      return { collections: [{ name: 'celllines', title: 'Human Cancer Cell Lines', type: 'quantification', dataset_count: 24 }] }
    }
    if (path === '/datasets') {
      return { total_pages: 1, datasets: [{ accession: 'PXD1', dataset_ref: 'PXD1/a' }, { accession: 'PXD1', dataset_ref: 'PXD1/b' }] }
    }
    const sp = (organism, datasets, proteins) => ({ organism, datasets, proteins, peptides: 0 })
    return {
      generated_at: '2026-10-27T10:49:49Z',
      kpis: { proteins: 289758, peptides: 5051438 },
      species: [
        sp('Homo sapiens', 191, 163890), sp('Mus musculus', 8, 51023), sp('Escherichia coli K-12', 2, 1388),
        sp('Danio rerio', 2, 41950), sp('Gossypium hirsutum', 1, 46772), sp('Triticum aestivum', 1, 57077),
      ],
      species_long_tail: { organisms: 29 },
    }
  }),
}))
import Home from './Home.vue'

async function mountHome() {
  const w = mount(Home, { global: { stubs: { RouterLink: RouterLinkStub, HomeGlance: true, ProteinSpotlight: true, HomeCode: true } } })
  await flushPromises()
  return w
}

describe('Home', () => {
  it('sends a search to the application that matches the query', async () => {
    const w = await mountHome()
    await w.find('.search-row input').setValue('P02768')
    await w.find('.search-row').trigger('submit')
    expect(push).toHaveBeenLastCalledWith({ path: '/apps/peptide-search', query: { mode: 'protein', query: 'P02768' } })
  })

  it('shows catalogue and search-index figures with their definitions', async () => {
    const w = await mountHome()
    const facts = w.find('.facts').text()
    expect(facts).toContain('Collections1')
    expect(facts).toContain('Datasets2from 1 source accessions')
    expect(facts).toContain('289.8K')
    expect(facts).toContain('5.1M')
    expect(w.find('.facts-note').text()).toContain('index generated 2026-10-27')
  })

  it('charts the most-studied organisms and says what was ranked', async () => {
    const w = await mountHome()
    const names = w.findAll('.organism-card .bar-name').map((n) => n.text())
    expect(names).toEqual(['Homo sapiens', 'Mus musculus', 'Escherichia coli K-12', 'Danio rerio', 'Gossypium hirsutum'])
    expect(w.find('.organism-card .bar-meta').text()).toBe('191 datasets')
    const caption = w.find('.organism-card figcaption').text()
    expect(caption).toContain('5 organisms with the most datasets, of the 6 organisms listed individually')
    expect(caption).toContain('(29 more are reported only as a combined group)')
    expect(caption).toContain('Index generated 2026-10-27')
  })

  it('links every live app and never nests a link inside another link', async () => {
    const w = await mountHome()
    const linkTo = (title) => w.findAllComponents(RouterLinkStub).find((l) => l.text() === title)?.props('to')
    expect(linkTo('Proteome Compass')).toBe('/apps/compass')
    expect(linkTo('Peptide Search')).toBe('/apps/peptide-search')
    expect(linkTo('Dataset Search')).toBe('/apps/dataset-search')
    expect(w.text()).not.toContain('Differential Expression')
    for (const a of w.findAll('.app-card a')) {
      expect(a.element.parentElement.closest('a')).toBeNull()
    }
  })

  it('sends an accession to Dataset Search, whatever the kind guessed', async () => {
    const w = await mountHome()
    await w.find('.search-row input').setValue('PXD000561')
    await w.find('.search-row').trigger('submit')
    expect(push).toHaveBeenLastCalledWith({ path: '/apps/dataset-search', query: { q: 'PXD000561' } })
    await w.find('.search-row select').setValue('peptide')
    await w.find('.search-row input').setValue('lvneltefak')
    await w.find('.search-row').trigger('submit')
    expect(push).toHaveBeenLastCalledWith({ path: '/apps/peptide-search', query: { mode: 'peptide', sequence: 'LVNELTEFAK' } })
  })
})
