// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (base, path) => {
    if (path.includes('apps')) {
      return {
        apps: [
          { id: 'peptide-search', title: 'Peptide Search', route: '/peptide-search', docs_url: 'https://api.example/docs', tier: 1 },
          { id: 'dataset-search', title: 'Dataset Search', route: '/dataset-search', base_url: 'https://api.example/ds', tier: 2 },
          { id: 'compass', title: 'Proteome Compass', base_url: 'https://api.example/compass', tier: 2 },
          { id: 'new-app', title: 'New App', route: '/apps/new', tier: 1 },
          { id: 'external', title: 'External', base_url: 'https://ext.example', docs_url: 'https://ext.example/docs' },
        ],
      }
    }
    return { collections: [] }
  }),
}))
import Home, { appRoute } from './Home.vue'

describe('appRoute', () => {
  it('maps app ids to portal routes and ignores the manifest route field', () => {
    // The live gateway manifest lists route "/dataset-search"; the page is /apps/dataset-search.
    expect(appRoute({ id: 'dataset-search', route: '/dataset-search' })).toBe('/apps/dataset-search')
    expect(appRoute({ id: 'peptide-search', route: '/peptide-search' })).toBe('/apps/peptide-search')
    expect(appRoute({ id: 'compass' })).toBe('/apps/compass')
    expect(appRoute({ id: 'differential-expression' })).toBe('/differential-expression')
    expect(appRoute({ id: 'unknown', route: '/apps/unknown' })).toBe('')
  })
})

describe('Home app cards', () => {
  it('never nests a link inside another link', async () => {
    const w = mount(Home, { global: { stubs: { RouterLink: RouterLinkStub, CollectionCard: true, StatsRibbon: true } } })
    await flushPromises()
    const cards = w.findAll('.app-card')
    expect(cards.length).toBeGreaterThan(0)
    for (const a of w.findAll('.app-card a')) {
      expect(a.element.parentElement.closest('a')).toBeNull()
    }
    const linkTo = (title) => w.findAllComponents(RouterLinkStub).find((l) => l.text() === title)?.props('to')
    expect(linkTo('Proteome Compass')).toBe('/apps/compass')
    expect(linkTo('Peptide Search')).toBe('/apps/peptide-search')
    expect(linkTo('Dataset Search')).toBe('/apps/dataset-search')
    const doc = w.find('.app-doclink')
    expect(doc.attributes('href')).toBe('https://api.example/docs')
  })
})
