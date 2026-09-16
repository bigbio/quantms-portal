// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  it('does not send its own page_view (GA history tracking reports navigations)', async () => {
    const { default: appRouter } = await import('./router.js')
    const gtag = vi.fn()
    window.gtag = gtag
    try {
      await appRouter.push('/statistics')
      await appRouter.push('/models')
      expect(gtag.mock.calls.filter((c) => c[1] === 'page_view')).toHaveLength(0)
    } finally {
      delete window.gtag
    }
  })

  it('updates document.title before the history entry is written', async () => {
    const { default: appRouter } = await import('./router.js')
    const titles = []
    const orig = window.history.pushState
    window.history.pushState = function (...args) {
      titles.push(document.title)
      return orig.apply(this, args)
    }
    try {
      await appRouter.push('/contact')
      expect(titles.at(-1)).toBe('Contact — quantms Portal')
    } finally {
      window.history.pushState = orig
    }
  })

  it('lets gtag send the initial page_view', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain("gtag('config', 'G-6PL70G5VC1')")
    expect(html).not.toContain('send_page_view')
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

describe('legacy routes', () => {
  it('redirects /search to Dataset Search, keeping the query text', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/search?q=liver')
    expect(router.currentRoute.value.fullPath).toBe('/apps/dataset-search?q=liver')
    await router.push('/search')
    expect(router.currentRoute.value.fullPath).toBe('/apps/dataset-search')
  })

  it('redirects /api to the API & MCP docs', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/api')
    expect(router.currentRoute.value.fullPath).toBe('/docs/ai-mcp')
  })
})
