// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import NavBar from './NavBar.vue'

async function mountNav() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div/>' } }] })
  router.push('/')
  await router.isReady()
  const w = mount(NavBar, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return w
}

describe('NavBar dropdowns', () => {
  it('keeps a hover-opened menu open when its trigger is then clicked (and on tap)', async () => {
    const w = await mountNav()
    const dropdown = w.findAll('.nav-dropdown')[0]
    const trigger = dropdown.find('button')
    await dropdown.trigger('mouseenter')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    // A second click closes it.
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    w.unmount()
  })

  it('toggles with clicks alone and closes on mouse leave', async () => {
    const w = await mountNav()
    const dropdown = w.findAll('.nav-dropdown')[1]
    const trigger = dropdown.find('button')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await dropdown.trigger('mouseenter')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await dropdown.trigger('mouseleave')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    w.unmount()
  })
})
