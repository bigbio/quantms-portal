// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'

const registry = vi.hoisted(() => ({ apps: [] }))
vi.mock('../api.js', () => ({ apiGet: vi.fn(async () => registry) }))
import Applications from './Applications.vue'

describe('Applications page', () => {
  it('renders a card per curated app, incl. Differential Expression', () => {
    const w = mount(Applications, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    const links = w.findAllComponents(RouterLinkStub)
    expect(links.length).toBe(6)
    expect(w.findAll('.app-card').length).toBe(7)
    const titles = w.findAll('.app-card-head h3').map((n) => n.text())
    expect(titles).toContain('Differential Expression')
    expect(titles).toContain('Proteome Compass')
    expect(titles).toContain('Cancer Cell Line Proteome')
    expect(links.find((c) => c.props('to') === '/apps/cell-lines')).toBeTruthy()
    expect(links.find((c) => c.props('to') === '/apps/qpx-explore')).toBeTruthy()
    // DE is obsolete: shown with a badge, not linked
    expect(links.find((c) => c.props('to') === '/differential-expression')).toBeFalsy()
    const obsolete = w.find('.app-card-obsolete')
    expect(obsolete.find('h3').text()).toBe('Differential Expression')
    expect(obsolete.find('.app-badge-obsolete').text()).toBe('Obsolete')
  })
  it('appends enabled registry apps the curated list lacks, without a portal link', async () => {
    registry.apps = [
      { id: 'quantms-api', kind: 'gateway', title: 'Collections & Publish API', enabled: true },
      { id: 'collections', title: 'Collections', enabled: true },
      { id: 'dataset-search', title: 'Dataset Search', enabled: true },
      { id: 'new-app', title: 'New App', description: 'Does new things.', docs_url: 'https://api.example/new-app/docs', enabled: true },
      { id: 'draft-app', title: 'Draft', enabled: false },
    ]
    const w = mount(Applications, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    expect(w.findAll('.app-card').length).toBe(8)
    const extra = w.find('.app-card-registry')
    expect(extra.find('h3').text()).toBe('New App')
    expect(extra.find('h3 a').exists()).toBe(false)
    expect(extra.text()).toContain('Does new things.')
    expect(extra.find('.app-doclink').attributes('href')).toBe('https://api.example/new-app/docs')
  })
})
