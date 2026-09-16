// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

const entries = [
  { name: 'P04637', gene_name: 'TP53', tags: ['liver', 'lung'], data: [[1, 2, 3], [4, 5]] },
  { name: 'P50851', gene_name: 'LRBA', tags: ['liver'], data: [[6]] },
]

let release
vi.mock('../utils/baseline.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loadGzipJson: vi.fn(() => new Promise((r) => { release = () => r(entries) })),
  }
})
import { loadGzipJson } from '../utils/baseline.js'
import BaselineExpression from './BaselineExpression.vue'

describe('BaselineExpression view', () => {
  it('ignores repeated Enter presses while loading and downloads the database once', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/baseline', component: BaselineExpression }],
    })
    router.push('/baseline')
    await router.isReady()
    const w = mount(BaselineExpression, { global: { plugins: [router] } })
    await flushPromises()

    const input = w.find('input.search-input')
    await input.setValue('TP53')
    await input.trigger('keyup', { key: 'Enter' })
    await input.trigger('keyup', { key: 'Enter' })
    // Clicking an example while the first add is pending is also ignored.
    await w.findAll('.example-link')[0].trigger('click')
    expect(w.text()).toContain('Loading expression database')

    release()
    await flushPromises()

    expect(loadGzipJson).toHaveBeenCalledTimes(1)
    expect(w.findAll('.protein-tag')).toHaveLength(1)
    expect(router.currentRoute.value.query.proteins).toBe('P04637')

    // Adding the same protein by accession is rejected as a duplicate.
    await input.setValue('p04637')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(w.findAll('.protein-tag')).toHaveLength(1)
    expect(w.text()).toContain('is already added')
    expect(loadGzipJson).toHaveBeenCalledTimes(1)
  })

  it('labels its controls', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/baseline', component: BaselineExpression }] })
    router.push('/baseline')
    await router.isReady()
    const w = mount(BaselineExpression, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.find('select.source-select').attributes('aria-label')).toBeTruthy()
    expect(w.find('input.search-input').attributes('aria-label')).toBeTruthy()
    expect(w.findAll('.tag-close').every((b) => b.attributes('aria-label'))).toBe(true)
  })
})
