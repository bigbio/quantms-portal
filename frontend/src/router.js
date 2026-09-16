import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import { DOCS_NAV } from './docs/nav.js'

export const SITE_TITLE = 'quantms Portal'
const HOME_TITLE = 'quantms Portal — Quantitative Proteomics Data'

const docTitles = Object.fromEntries(DOCS_NAV.flatMap((g) => g.items.map((i) => [i.slug, i.title])))

export const routes = [
  { path: '/', component: Home, meta: { title: null } },
  { path: '/collections', component: () => import('./views/Collections.vue'), meta: { title: 'Collections' } },
  { path: '/collections/:name', component: () => import('./views/CollectionDetail.vue'), meta: { title: (r) => `${r.params.name} collection` } },
  { path: '/collections/:name/:pxd', component: () => import('./views/DatasetDetail.vue'), meta: { title: (r) => `${r.params.pxd} dataset` } },
  { path: '/apps/dataset-search', component: () => import('./views/DatasetSearch.vue'), meta: { title: 'Dataset Search' } },
  { path: '/apps/peptide-search', component: () => import('./views/PeptideSearch.vue'), meta: { title: 'Peptide & Protein Search' } },
  { path: '/apps/compass', component: () => import('./views/ProteomeCompass.vue'), meta: { title: 'Proteome Compass' } },
  { path: '/apps/coexpression', component: () => import('./views/Coexpression.vue'), meta: { title: 'Protein Co-expression' } },
  { path: '/search', component: () => import('./views/Search.vue'), meta: { title: 'Search' } },
  { path: '/statistics', component: () => import('./views/Statistics.vue'), meta: { title: 'Statistics' } },
  { path: '/api', component: () => import('./views/ApiDocs.vue'), meta: { title: 'API' } },
  { path: '/docs', redirect: '/docs/introduction' },
  { path: '/docs/:page', component: () => import('./views/DocsPage.vue'), meta: { title: (r) => `${docTitles[r.params.page] || 'Documentation'} · Docs` } },
  { path: '/baseline', component: () => import('./views/BaselineExpression.vue'), meta: { title: 'Baseline Expression' } },
  { path: '/models', component: () => import('./views/Models.vue'), meta: { title: 'Models' } },
  { path: '/contact', component: () => import('./views/Contact.vue'), meta: { title: 'Contact' } },
  { path: '/differential-expression', component: () => import('./views/DifferentialExpression.vue'), meta: { title: 'Differential Expression' } },
  { path: '/applications', component: () => import('./views/Applications.vue'), meta: { title: 'Applications' } },
  // Catch-all: unknown URLs render a real "not found" page instead of a blank one.
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFound.vue'), meta: { title: 'Page not found' } },
]

// Height of the fixed navbar, so anchored headings aren't hidden under it.
const NAV_OFFSET = 80

// Back/forward restores the previous position; `#anchor` links land on their
// target; a query-only change on the same page (search filters synced to the
// URL) keeps the current position; any other navigation starts at the top.
export function scrollBehavior(to, from, savedPosition) {
  if (savedPosition) return savedPosition
  if (to.hash) {
    // Wait a tick so content rendered after the route resolves (docs) exists.
    return new Promise((resolve) => {
      setTimeout(() => resolve({ el: to.hash, top: NAV_OFFSET }), 0)
    })
  }
  if (from && from.matched && from.matched.length && to.path === from.path) return false
  return { top: 0 }
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior,
})

// Document title for a resolved route: "<page> — quantms Portal".
export function resolveTitle(to) {
  const t = to && to.meta ? to.meta.title : undefined
  const page = typeof t === 'function' ? t(to) : t
  return page ? `${page} — ${SITE_TITLE}` : HOME_TITLE
}

router.afterEach((to) => {
  if (typeof document !== 'undefined') document.title = resolveTitle(to)
})

// SPA page views. index.html configures gtag with send_page_view: false, so
// this hook is the single source of page_view events — including the initial
// load — and each view is reported exactly once with its own title. Guarded so
// it is a no-op when analytics is absent (e.g. blocked or local dev).
router.afterEach((to) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: to.fullPath,
      page_location: window.location.href,
      page_title: document.title,
    })
  }
})

// A lazy route chunk can fail to load, most often right after a deploy (the
// open page still references old hashed assets) or on a flaky connection.
// Reload once onto the target URL so the browser fetches the current build;
// the sessionStorage flag prevents a reload loop if the failure persists.
const CHUNK_RELOAD_KEY = 'quantms-chunk-reload'

export function isChunkLoadError(err) {
  const msg = String((err && err.message) || err || '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk .* failed/i.test(msg)
}

export function handleChunkError(err, to, { storage, location } = {}) {
  if (!isChunkLoadError(err)) return false
  const target = (to && to.fullPath) || '/'
  let last = null
  try { last = storage && storage.getItem(CHUNK_RELOAD_KEY) } catch { /* storage unavailable */ }
  if (last === target) return false
  try { storage && storage.setItem(CHUNK_RELOAD_KEY, target) } catch { /* storage unavailable */ }
  location.assign(target)
  return true
}

router.onError((err, to) => {
  if (typeof window === 'undefined') return
  let storage = null
  try { storage = window.sessionStorage } catch { /* blocked */ }
  handleChunkError(err, to, { storage, location: window.location })
})

// A successful navigation clears the guard so a later deploy can reload again.
router.afterEach(() => {
  try { window.sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch { /* blocked */ }
})

export default router
