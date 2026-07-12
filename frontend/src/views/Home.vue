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
        <CollectionCard v-for="col in collections" :key="col.name" :collection="col" @select="goToCollection" />
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
        <component
          :is="app.to ? 'router-link' : 'a'"
          v-for="app in appCards"
          :key="app.id"
          :to="app.to || undefined"
          :href="app.href || undefined"
          :target="app.href ? '_blank' : undefined"
          :rel="app.href ? 'noopener' : undefined"
          class="app-card"
        >
          <div class="app-card-head">
            <h3>{{ app.title }}</h3>
            <span class="app-tier">tier {{ app.tier }}</span>
          </div>
          <p class="app-desc">{{ app.description }}</p>
          <div class="app-links">
            <span v-if="app.to" class="app-cta">Open →</span>
            <a v-if="app.docs_url" :href="app.docs_url" target="_blank" rel="noopener" class="app-doclink" @click.stop>API docs ↗</a>
          </div>
        </component>
      </div>

      <div class="api-hub">
        Building an agent or client? Explore every backend — including the
        <a :href="apiDocsUrl" target="_blank" rel="noopener">Collections &amp; Publish API ↗</a>.
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StatsRibbon from '../components/StatsRibbon.vue'
import CollectionCard from '../components/CollectionCard.vue'
import { apiGet } from '../api.js'
import { GATEWAY_BASE, DATASET_SEARCH_BASE, API_DOCS_URL } from '../config.js'

const router = useRouter()
const apiDocsUrl = API_DOCS_URL

const collections = ref([])
const globalStats = ref(null)
const loadingCollections = ref(true)
const collectionsError = ref(false)

const apps = ref([])
const appsError = ref(false)

// Map app id -> in-portal route.
const APP_ROUTES = {
  collections: '/collections',
  'dataset-search': '/apps/dataset-search',
  'peptide-search': '/apps/peptide-search',
  statistics: '/statistics',
}

// Descriptions for apps whose manifest ships an empty description.
const APP_FALLBACK_DESC = {
  collections: 'Browse and filter datasets grouped into curated collections.',
  statistics: 'Portal-wide statistics — peptides, proteins, datasets, species, PTMs and proteome coverage.',
}

const appCards = computed(() =>
  apps.value
    // The gateway self-entry (Collections & Publish API) is the API hub, not a
    // user-facing app — it is surfaced via the API-hub link below, not as a card.
    .filter((a) => a.enabled !== false && a.kind !== 'gateway' && (APP_ROUTES[a.id] || a.docs_url))
    .map((a) => ({
      id: a.id,
      title: a.title || a.id,
      description: a.description || APP_FALLBACK_DESC[a.id] || 'quantms service.',
      tier: a.tier ?? 1,
      to: APP_ROUTES[a.id] || '',
      href: APP_ROUTES[a.id] ? '' : a.base_url || a.docs_url || '',
      docs_url: a.docs_url || '',
    }))
)

function goToCollection(name) {
  router.push(`/collections/${name}`)
}

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
  display: block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 22px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
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
