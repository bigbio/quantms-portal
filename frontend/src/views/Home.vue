<template>
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-badge">AI-Ready Proteomics Data</div>
      <h1>The Quantitative Proteomics<br />Data Portal</h1>
      <p class="hero-sub">
        Browse, query, and download standardized proteomics datasets in
        <strong>QPX format</strong>. Built for AI agents, bioinformaticians, and researchers.
      </p>
      <div class="hero-actions">
        <router-link to="/apps/dataset-search" class="btn btn-primary">Search datasets</router-link>
        <router-link to="/apps/peptide-search" class="btn btn-outline">Peptide / protein search</router-link>
      </div>
    </div>
  </section>

  <StatsRibbon v-if="globalStats" :stats="globalStats" />

  <!-- Collections (listed first) -->
  <section class="section" id="collections">
    <div class="container">
      <div class="section-header">
        <h2>Collections</h2>
        <p>Curated groups of datasets, each with specialized indexes and services built on top.</p>
      </div>

      <div v-if="collectionsError" class="notice">
        Collections are temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="loadCollections">Retry</button>
      </div>
      <div v-else-if="loadingCollections" class="collection-grid">
        <div v-for="n in 4" :key="n" class="skeleton-card"></div>
      </div>
      <div v-else class="collection-grid">
        <CollectionCard v-for="col in collections" :key="col.name" :collection="col" />
      </div>
    </div>
  </section>

  <!-- Applications (the app catalog, gateway API excluded) -->
  <section class="section section-alt" id="apps">
    <div class="container">
      <div class="section-header">
        <h2>Applications</h2>
        <p>Live services over the quantms data — each one also served to AI agents over MCP.</p>
      </div>

      <div v-if="appsError" class="notice">
        The app catalog is temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="loadApps">Retry</button>
      </div>

      <div v-else class="app-grid">
        <!-- The card is a plain container whose title link is stretched over
             the whole card, so the separate "API docs" link isn't nested
             inside another link (invalid HTML). -->
        <div v-for="app in appCards" :key="app.id" class="app-card">
          <div class="app-card-head">
            <h3>
              <router-link v-if="app.to" :to="app.to" class="app-card-link">{{ app.title }}</router-link>
              <a v-else :href="app.href" target="_blank" rel="noopener" class="app-card-link">{{ app.title }}</a>
            </h3>
            <span class="app-tier">tier {{ app.tier }}</span>
          </div>
          <p class="app-desc">{{ app.description }}</p>
          <div class="app-links">
            <span v-if="app.to" class="app-cta" aria-hidden="true">Open →</span>
            <a v-if="app.docs_url" :href="app.docs_url" target="_blank" rel="noopener" class="app-doclink">API docs ↗</a>
          </div>
        </div>
      </div>

      <div class="api-hub">
        Building an agent or client? Explore every backend — including the
        <a :href="apiDocsUrl" target="_blank" rel="noopener">Collections &amp; Publish API ↗</a>.
      </div>
    </div>
  </section>
</template>

<script>
// Map app id -> in-portal route.
const APP_ROUTES = {
  collections: '/collections',
  'dataset-search': '/apps/dataset-search',
  'peptide-search': '/apps/peptide-search',
  compass: '/apps/compass',
  coexpression: '/apps/coexpression',
  'differential-expression': '/differential-expression',
  statistics: '/statistics',
}

// In-portal route for an app. Only the id mapping above is used: the gateway
// manifest's `route` field is not a portal path (it lists /dataset-search while
// the page lives at /apps/dataset-search), so it must not drive links.
export function appRoute(app) {
  return APP_ROUTES[app?.id] || ''
}
</script>

<script setup>
import { ref, computed, onMounted } from 'vue'
import StatsRibbon from '../components/StatsRibbon.vue'
import CollectionCard from '../components/CollectionCard.vue'
import { apiGet } from '../api.js'
import { safeHref } from '../utils/links.js'
import { GATEWAY_BASE, DATASET_SEARCH_BASE, API_DOCS_URL } from '../config.js'

const apiDocsUrl = API_DOCS_URL

const collections = ref([])
const globalStats = ref(null)
const loadingCollections = ref(true)
const collectionsError = ref(false)

const apps = ref([])
const appsError = ref(false)

// Descriptions for apps whose manifest ships an empty description.
const APP_FALLBACK_DESC = {
  collections: 'Browse and filter datasets grouped into curated collections.',
  statistics: 'Portal-wide statistics — peptides, proteins, datasets, species, PTMs and proteome coverage.',
}

const appCards = computed(() =>
  apps.value
    // The gateway self-entry (Collections & Publish API) is the API hub, not a
    // user-facing app — it is surfaced via the API-hub link below, not as a card.
    .filter((a) => a.enabled !== false && a.kind !== 'gateway' && (appRoute(a) || safeHref(a.base_url) || safeHref(a.docs_url)))
    .map((a) => ({
      id: a.id,
      title: a.title || a.id,
      description: a.description || APP_FALLBACK_DESC[a.id] || 'quantms service.',
      tier: a.tier ?? 1,
      to: appRoute(a),
      href: appRoute(a) ? '' : safeHref(a.base_url) || safeHref(a.docs_url),
      docs_url: safeHref(a.docs_url),
    }))
)


async function loadCollections() {
  loadingCollections.value = true
  collectionsError.value = false
  try {
    const data = await apiGet(DATASET_SEARCH_BASE, '/collections')
    const list = data.collections || []
    collections.value = list.map((c) => ({
      name: c.name,
      title: c.title || c.name,
      description: c.description || '',
      dataset_count: c.dataset_count || 0,
      organisms: c.organisms || [],
      stats: { total_peptides: c.total_peptides || 0, total_proteins: c.total_proteins || 0 },
    }))
    globalStats.value = {
      total_collections: list.length,
      total_datasets: list.reduce((s, c) => s + (c.dataset_count || 0), 0),
      total_peptides: list.reduce((s, c) => s + (c.total_peptides || 0), 0),
      total_proteins: list.reduce((s, c) => s + (c.total_proteins || 0), 0),
    }
  } catch (e) {
    collectionsError.value = true
  } finally {
    loadingCollections.value = false
  }
}

async function loadApps() {
  appsError.value = false
  try {
    const data = await apiGet(GATEWAY_BASE, '/apps')
    apps.value = data.apps || []
  } catch (e) {
    appsError.value = true
  }
}

onMounted(() => {
  loadCollections()
  loadApps()
})
</script>

<style scoped>
.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 8px;
}
.app-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.app-card {
  position: relative;
  display: block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 22px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}
.app-card-link {
  color: inherit;
  text-decoration: none;
}
/* Stretch the title link over the card so the whole card stays clickable. */
.app-card-link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
}
.app-card-link:focus-visible {
  outline: none;
}
.app-card:has(.app-card-link:focus-visible) {
  outline: 2px solid var(--indigo);
  outline-offset: 2px;
}
.app-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.08);
  transform: translateY(-2px);
}
.app-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.app-card-head h3 {
  font-size: 16px;
  font-weight: 700;
}
.app-tier {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
}
.app-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-bottom: 14px;
}
.app-links {
  display: flex;
  align-items: center;
  gap: 16px;
}
.app-cta {
  font-size: 13px;
  font-weight: 600;
  color: var(--indigo);
}
.app-doclink {
  position: relative;
  z-index: 1;
  font-size: 12px;
  color: var(--text-muted);
  text-decoration: none;
}
.app-doclink:hover {
  color: var(--indigo);
}
.api-hub {
  margin-top: 28px;
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
}
.api-hub a {
  color: var(--indigo);
  text-decoration: none;
  font-weight: 600;
}
.skeleton-card {
  height: 220px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.notice {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-secondary);
}
@media (max-width: 1024px) {
  .app-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 768px) {
  .app-grid {
    grid-template-columns: 1fr;
  }
}
</style>
