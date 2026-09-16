// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes, isChunkLoadError, handleChunkError } from './router.js'
import NotFound from './views/NotFound.vue'

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes })
}

describe('router', () => {
  it('resolves unknown paths to the not-found route', () => {
    const router = makeRouter()
    expect(router.resolve('/this-page-does-not-exist').name).toBe('not-found')
    expect(router.resolve('/apps/unknown/deep/path').name).toBe('not-found')
  })

  it('keeps known routes matched ahead of the catch-all', () => {
    const router = makeRouter()
    expect(router.resolve('/collections/msnet').name).not.toBe('not-found')
    expect(router.resolve('/apps/peptide-search').name).not.toBe('not-found')
    expect(router.resolve('/').name).not.toBe('not-found')
  })

  it('renders the requested path and a way back home', async () => {
    const router = makeRouter()
    router.push('/nope/here')
    await router.isReady()
    const w = mount(NotFound, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.text()).toContain('Page not found')
    expect(w.text()).toContain('/nope/here')
    expect(w.find('a[href="/"]').exists()).toBe(true)
  })
})

describe('chunk load recovery', () => {
  function memoryStorage() {
    const m = new Map()
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }
  }

  it('recognises dynamic import and CSS preload failures', () => {
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/Collections-x.css'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/a.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Something else'))).toBe(false)
  })

  it('reloads once onto the target route, then stops', () => {
    const storage = memoryStorage()
    const location = { assign: vi.fn() }
    const err = new Error('Unable to preload CSS for /assets/x.css')
    expect(handleChunkError(err, { fullPath: '/collections' }, { storage, location })).toBe(true)
    expect(location.assign).toHaveBeenCalledWith('/collections')
    expect(handleChunkError(err, { fullPath: '/collections' }, { storage, location })).toBe(false)
    expect(location.assign).toHaveBeenCalledTimes(1)
  })

  it('ignores unrelated errors', () => {
    const location = { assign: vi.fn() }
    expect(handleChunkError(new Error('boom'), { fullPath: '/' }, { storage: memoryStorage(), location })).toBe(false)
    expect(location.assign).not.toHaveBeenCalled()
  })
})
