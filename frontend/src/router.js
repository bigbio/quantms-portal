import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/collections', component: () => import('./views/Collections.vue') },
  { path: '/collections/:name', component: () => import('./views/CollectionDetail.vue') },
  { path: '/collections/:name/:pxd', component: () => import('./views/DatasetDetail.vue') },
  { path: '/apps/dataset-search', component: () => import('./views/DatasetSearch.vue') },
  { path: '/search', component: () => import('./views/Search.vue') },
  { path: '/statistics', component: () => import('./views/Statistics.vue') },
  { path: '/api', component: () => import('./views/ApiDocs.vue') },
  { path: '/baseline', component: () => import('./views/BaselineExpression.vue') },
  { path: '/models', component: () => import('./views/Models.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } }
})
