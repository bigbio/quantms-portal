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
    const titles = w.findAll('.app-card-head h3').map((n) => n.text())
    expect(titles).toContain('Differential Expression')
    expect(titles).toContain('Proteome Compass')
    // the DE card points at the live route
    const de = cards.find((c) => c.props('to') === '/differential-expression')
    expect(de).toBeTruthy()
  })
})
