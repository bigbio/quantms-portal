// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async (base, path) => {
    if (path.includes('apps')) {
      return {
        apps: [
          { id: 'peptide-search', title: 'Peptide Search', docs_url: 'https://api.example/docs', tier: 1 },
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
  it('prefers a portal path from the manifest, then the id mapping', () => {
    expect(appRoute({ id: 'x', route: '/apps/x' })).toBe('/apps/x')
    expect(appRoute({ id: 'compass' })).toBe('/apps/compass')
    expect(appRoute({ id: 'differential-expression' })).toBe('/differential-expression')
    expect(appRoute({ id: 'x', route: 'https://evil.example' })).toBe('')
    expect(appRoute({ id: 'x', route: '//evil.example' })).toBe('')
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
    const compass = w.findAllComponents(RouterLinkStub).find((l) => l.text() === 'Proteome Compass')
    expect(compass.props('to')).toBe('/apps/compass')
    const doc = w.find('.app-doclink')
    expect(doc.attributes('href')).toBe('https://api.example/docs')
  })
})
