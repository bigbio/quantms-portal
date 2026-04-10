import { createRouter, createWebHashHistory } from 'vue-router'
import Home from './views/Home.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/collections', component: () => import('./views/Collections.vue') },
  { path: '/collections/:name', component: () => import('./views/CollectionDetail.vue') },
  { path: '/collections/:name/:pxd', component: () => import('./views/DatasetDetail.vue') },
  { path: '/search', component: () => import('./views/Search.vue') },
  { path: '/statistics', component: () => import('./views/Statistics.vue') },
  { path: '/api', component: () => import('./views/ApiDocs.vue') },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 } }
})
