// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import Applications from './Applications.vue'

describe('Applications page', () => {
  it('renders a card per curated app, incl. Differential Expression', () => {
    const w = mount(Applications, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    })
    const cards = w.findAllComponents(RouterLinkStub)
    expect(cards.length).toBe(5)
    expect(w.findAll('.app-card').length).toBe(6)
    const titles = w.findAll('.app-card-head h3').map((n) => n.text())
    expect(titles).toContain('Differential Expression')
    expect(titles).toContain('Proteome Compass')
    expect(titles).toContain('Protein Co-expression')
    expect(cards.find((c) => c.props('to') === '/apps/coexpression')).toBeTruthy()
    // DE is obsolete: shown with a badge, not linked
    expect(cards.find((c) => c.props('to') === '/differential-expression')).toBeFalsy()
    const obsolete = w.find('.app-card-obsolete')
    expect(obsolete.find('h3').text()).toBe('Differential Expression')
    expect(obsolete.find('.app-badge-obsolete').text()).toBe('Obsolete')
  })
})
