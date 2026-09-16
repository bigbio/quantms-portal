// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import DocsLayout from './DocsLayout.vue'

describe('DocsLayout', () => {
  it('does not add a second <main> landmark', () => {
    const w = mount(DocsLayout, { props: { current: 'introduction' }, global: { stubs: { RouterLink: RouterLinkStub } } })
    expect(w.find('main').exists()).toBe(false)
    expect(w.find('article.docs-content').exists()).toBe(true)
  })

  it('exposes the mobile menu state to assistive tech', async () => {
    const w = mount(DocsLayout, { props: { current: 'introduction' }, global: { stubs: { RouterLink: RouterLinkStub } } })
    const btn = w.find('.docs-menu-btn')
    expect(btn.attributes('aria-expanded')).toBe('false')
    expect(btn.attributes('aria-controls')).toBe('docs-sidebar')
    await btn.trigger('click')
    expect(btn.attributes('aria-expanded')).toBe('true')
  })
})
