// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes, isChunkLoadError, handleChunkError, resolveTitle, scrollBehavior } from './router.js'
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

describe('page titles', () => {
  const router = createRouter({ history: createMemoryHistory(), routes })
  const title = (path) => resolveTitle(router.resolve(path))

  it('gives every page its own title', () => {
    expect(title('/')).toBe('quantms Portal — Quantitative Proteomics Data')
    expect(title('/apps/peptide-search')).toBe('Peptide & Protein Search — quantms Portal')
    expect(title('/statistics')).toBe('Statistics — quantms Portal')
    expect(title('/nope')).toBe('Page not found — quantms Portal')
  })

  it('includes route parameters for detail and docs pages', () => {
    expect(title('/collections/msnet')).toBe('msnet collection — quantms Portal')
    expect(title('/collections/msnet/PXD000561')).toBe('PXD000561 dataset — quantms Portal')
    expect(title('/docs/ps-gpp')).toBe('Evidence quality (GPP) · Docs — quantms Portal')
    expect(title('/docs/unknown')).toBe('Documentation · Docs — quantms Portal')
  })

  it('has a title for every route', () => {
    for (const r of routes) {
      if (r.redirect) continue
      expect(r.meta && 'title' in r.meta, r.path).toBe(true)
    }
  })

  it('sends exactly one page_view per navigation, with the new title', async () => {
    const { default: appRouter } = await import('./router.js')
    const gtag = vi.fn()
    window.gtag = gtag
    try {
      await appRouter.push('/statistics')
      await appRouter.push('/models')
      const views = gtag.mock.calls.filter((c) => c[1] === 'page_view')
      expect(views).toHaveLength(2)
      expect(views[1][2]).toMatchObject({ page_path: '/models', page_title: 'Models — quantms Portal' })
    } finally {
      delete window.gtag
    }
  })
})

describe('scrollBehavior', () => {
  const at = (path, extra = {}) => ({ path, hash: '', matched: [{}], ...extra })

  it('restores the saved position on back/forward', () => {
    expect(scrollBehavior(at('/a'), at('/b'), { left: 0, top: 420 })).toEqual({ left: 0, top: 420 })
  })

  it('scrolls to an anchor below the fixed navbar', async () => {
    await expect(scrollBehavior(at('/docs/ps-gpp', { hash: '#cutoff' }), at('/docs/intro'), null))
      .resolves.toEqual({ el: '#cutoff', top: 80 })
  })

  it('keeps the position for query-only changes on the same page', () => {
    expect(scrollBehavior(at('/apps/dataset-search'), at('/apps/dataset-search'), null)).toBe(false)
  })

  it('starts other navigations at the top, including the first load', () => {
    expect(scrollBehavior(at('/models'), at('/statistics'), null)).toEqual({ top: 0 })
    expect(scrollBehavior(at('/models'), { path: '/', matched: [] }, null)).toEqual({ top: 0 })
  })
})
