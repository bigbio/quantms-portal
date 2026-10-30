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
  const w = mount(Home, { global: { stubs: { RouterLink: RouterLinkStub } } })
  await flushPromises()
  return w
}

describe('Home', () => {
  it('shows catalogue and search-index figures with their definitions', async () => {
    const w = await mountHome()
    const facts = w.find('.facts').text()
    expect(facts).toContain('Collections1')
    expect(facts).toContain('Datasets2from 1 source accessions')
    expect(facts).toContain('289.8K')
    expect(facts).toContain('5.1M')
    expect(w.find('.facts-note').text()).toContain('index generated 2026-10-27')
  })

  it('charts the organisms with the most distinct proteins and says what was ranked', async () => {
    const w = await mountHome()
    const names = w.findAll('.organism-card .bar-name').map((n) => n.text())
    expect(names).toEqual(['Homo sapiens', 'Triticum aestivum', 'Mus musculus', 'Gossypium hirsutum', 'Danio rerio'])
    expect(w.find('.organism-card .bar-meta').text()).toBe('191 datasets')
    const caption = w.find('.organism-card figcaption').text()
    expect(caption).toContain('largest of the 6 organisms listed individually')
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

  it('sends the search form to Dataset Search with its query and collection', async () => {
    const w = await mountHome()
    await w.find('.search-row input').setValue('PXD000561')
    await w.find('.search-row select').setValue('celllines')
    await w.find('.search-row').trigger('submit')
    expect(push).toHaveBeenCalledWith({ path: '/apps/dataset-search', query: { q: 'PXD000561', collection: 'celllines' } })
  })
})
