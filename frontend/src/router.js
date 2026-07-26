import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/collections', component: () => import('./views/Collections.vue') },
  { path: '/collections/:name', component: () => import('./views/CollectionDetail.vue') },
  { path: '/collections/:name/:pxd', component: () => import('./views/DatasetDetail.vue') },
  { path: '/apps/dataset-search', component: () => import('./views/DatasetSearch.vue') },
  { path: '/apps/peptide-search', component: () => import('./views/PeptideSearch.vue') },
  { path: '/apps/compass', component: () => import('./views/ProteomeCompass.vue') },
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

export default router
