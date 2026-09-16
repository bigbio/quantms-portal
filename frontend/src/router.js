import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'

export const routes = [
  { path: '/', component: Home },
  { path: '/collections', component: () => import('./views/Collections.vue') },
  { path: '/collections/:name', component: () => import('./views/CollectionDetail.vue') },
  { path: '/collections/:name/:pxd', component: () => import('./views/DatasetDetail.vue') },
  { path: '/apps/dataset-search', component: () => import('./views/DatasetSearch.vue') },
  { path: '/apps/peptide-search', component: () => import('./views/PeptideSearch.vue') },
  { path: '/apps/compass', component: () => import('./views/ProteomeCompass.vue') },
  { path: '/apps/coexpression', component: () => import('./views/Coexpression.vue') },
  { path: '/search', component: () => import('./views/Search.vue') },
  { path: '/statistics', component: () => import('./views/Statistics.vue') },
  { path: '/api', component: () => import('./views/ApiDocs.vue') },
  { path: '/docs', redirect: '/docs/introduction' },
  { path: '/docs/:page', component: () => import('./views/DocsPage.vue') },
  { path: '/baseline', component: () => import('./views/BaselineExpression.vue') },
  { path: '/models', component: () => import('./views/Models.vue') },
  { path: '/contact', component: () => import('./views/Contact.vue') },
  { path: '/differential-expression', component: () => import('./views/DifferentialExpression.vue') },
  { path: '/applications', component: () => import('./views/Applications.vue') },
  // Catch-all: unknown URLs render a real "not found" page instead of a blank one.
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFound.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } }
})

// SPA page views: gtag('config') in index.html only fires on the initial load,
// so client-side navigations must report a page_view themselves. Guarded so it
// is a no-op when analytics is absent (e.g. blocked or local dev).
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
