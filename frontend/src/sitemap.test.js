// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes } from './router.js'
import { DOCS_NAV } from './docs/nav.js'

const sitemap = readFileSync(resolve(process.cwd(), 'public/sitemap.xml'), 'utf8')
const paths = [...sitemap.matchAll(/<loc>https:\/\/portal\.quantms\.org([^<]*)<\/loc>/g)].map((m) => m[1])

describe('sitemap.xml', () => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  it('only lists URLs that resolve to a real page (no redirects or 404s)', () => {
    for (const p of paths) {
      const r = router.resolve(p)
      expect(r.name, p).not.toBe('not-found')
      expect(r.redirectedFrom, p).toBeUndefined()
      expect(r.matched.some((m) => m.redirect), p).toBe(false)
    }
  })

  it('covers every docs page and the main apps', () => {
    for (const slug of DOCS_NAV.flatMap((g) => g.items.map((i) => i.slug))) {
      expect(paths).toContain(`/docs/${slug}`)
    }
    for (const p of ['/', '/applications', '/apps/dataset-search', '/apps/peptide-search', '/apps/compass', '/apps/coexpression', '/differential-expression', '/statistics']) {
      expect(paths).toContain(p)
    }
  })

  it('has no duplicate URLs', () => {
    expect(new Set(paths).size).toBe(paths.length)
  })
})
