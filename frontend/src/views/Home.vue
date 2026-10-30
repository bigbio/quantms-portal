<template>
  <section class="intro">
    <div class="container intro-grid">
      <div>
        <h1>quantms data portal</h1>
        <p class="lede">
          Browse, query, and download standardized proteomics datasets in QPX format.
          Built for AI agents, bioinformaticians, and researchers.
        </p>
        <form class="search-row" role="search" @submit.prevent="searchDatasets">
          <input v-model.trim="q" type="search" placeholder="Accession, title, organism, instrument…" aria-label="Search datasets" />
          <select v-model="collection" aria-label="Collection">
            <option value="">All collections</option>
            <option v-for="c in collections" :key="c.name" :value="c.name">{{ c.title || c.name }}</option>
          </select>
          <button class="btn" type="submit">Search datasets</button>
        </form>
        <p class="search-hint">
          Or look up a peptide or protein:
          <router-link :to="{ path: '/apps/peptide-search', query: { sequence: 'ADSRDPASDQMQHWK' } }"><code>ADSRDPASDQMQHWK</code></router-link>,
          <router-link :to="{ path: '/apps/peptide-search', query: { mode: 'protein', query: 'P04040' } }"><code>P04040</code></router-link>
        </p>
      </div>
      <OrganismProteins :stats="stats" :failed="statsFailed" />
    </div>

    <!-- Key figures read live: placeholders hold their place while loading; a source
         that fails to load is left out. -->
    <div v-if="!(catalogFailed && statsFailed)" class="container facts-band" :aria-busy="!catalog && !index">
      <dl class="facts">
        <template v-if="!catalogFailed">
          <div><dt>Collections</dt><dd><LiveValue :value="catalog?.collections" width="1ch" /></dd></div>
          <div>
            <dt>Datasets</dt>
            <dd>
              <LiveValue :value="catalog?.datasets" width="2.2ch" />
              <small>from <LiveValue :value="catalog?.accessions" width="2ch" /> source accessions</small>
            </dd>
          </div>
        </template>
        <template v-if="!statsFailed">
          <div>
            <dt>Proteins in search index</dt>
            <dd><LiveValue :value="index && formatBig(index.proteins)" :title="index?.proteins.toLocaleString()" width="3.6ch" /></dd>
          </div>
          <div>
            <dt>Peptides in search index</dt>
            <dd><LiveValue :value="index && formatBig(index.peptides)" :title="index?.peptides.toLocaleString()" width="3ch" /></dd>
          </div>
        </template>
      </dl>
      <p class="facts-note">
        <span v-if="!catalogFailed">Collections and datasets: current portal catalogue; a dataset listed in more than one collection is counted once.</span>
        <span v-if="!statsFailed">
          Proteins and peptides: distinct counts over the peptide search index, which also covers retired collections; index generated
          <LiveValue :value="index?.generated" width="6em" />.
        </span>
      </p>
    </div>
  </section>

  <section class="section" id="collections">
    <div class="container">
      <h2 class="rule-title">Collections</h2>
      <p class="section-lede">Curated groups of datasets, each with specialized indexes and services built on top.</p>
      <div v-if="collectionsError" class="notice">
        Collections are temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="loadCollections">Retry</button>
      </div>
      <CollectionsTable v-else :collections="collections" :loading="loadingCollections" />
      <p class="table-note">
        Per-collection peptide and protein counts from the search index are on the
        <router-link to="/statistics">Statistics</router-link> page.
      </p>
    </div>
  </section>

  <section class="section section-alt" id="apps">
    <div class="container">
      <h2 class="rule-title">Applications</h2>
      <p class="section-lede">Live services over the quantms data.</p>
      <AppGrid :apps="[...apps, ...registry]" />
      <p class="api-hub">
        API documentation: <a :href="apiDocsUrl" target="_blank" rel="noopener">api.quantms.org/docs</a>
        (collections, dataset search and peptide search) and the “API docs” link of each application.
        AI agents can list collections, datasets and applications through the MCP endpoint
        <code>https://publish.quantms.org/mcp/</code>.
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CollectionsTable from '../components/CollectionsTable.vue'
import AppGrid from '../components/AppGrid.vue'
import OrganismProteins from '../components/OrganismProteins.vue'
import LiveValue from '../components/LiveValue.vue'
import { apiGet } from '../api.js'
import { countDistinctDatasets } from '../catalog.js'
import { formatBig } from '../utils/format.js'
import { APPS, registryApps } from '../apps.js'
import { DATASET_SEARCH_BASE, BROWSE_BASE, STATS_PATH, API_DOCS_URL } from '../config.js'

const apiDocsUrl = API_DOCS_URL
const apps = APPS.filter((a) => !a.obsolete)
// Registry-only apps; when the gateway is unreachable the curated list stands alone.
const registry = ref([])
const router = useRouter()

const collections = ref([])
const loadingCollections = ref(true)
const collectionsError = ref(false)
// Published catalogue: { collections, datasets, accessions }.
const catalog = ref(null)
const catalogFailed = ref(false)
// stats.json of the peptide search index.
const stats = ref(null)
const statsFailed = ref(false)
const index = computed(() =>
  stats.value && { proteins: stats.value.kpis.proteins, peptides: stats.value.kpis.peptides, generated: stats.value.generated_at.slice(0, 10) }
)

const q = ref('')
const collection = ref('')

function searchDatasets() {
  const query = {}
  if (q.value) query.q = q.value
  if (collection.value) query.collection = collection.value
  router.push({ path: '/apps/dataset-search', query })
}

async function loadCollections() {
  loadingCollections.value = true
  collectionsError.value = false
  catalogFailed.value = false
  try {
    const data = await apiGet(DATASET_SEARCH_BASE, '/collections')
    collections.value = data.collections || []
  } catch (e) {
    collectionsError.value = true
    catalogFailed.value = true
    return
  } finally {
    loadingCollections.value = false
  }
  // The key figures are optional: when the count fails they are left out.
  countDistinctDatasets()
    .then((n) => { catalog.value = { collections: collections.value.length, ...n } })
    .catch(() => { catalogFailed.value = true })
}

onMounted(() => {
  loadCollections()
  apiGet(BROWSE_BASE, STATS_PATH)
    .then((s) => { stats.value = s })
    .catch(() => { statsFailed.value = true })
  registryApps().then((r) => (registry.value = r), () => {})
})
</script>

<style scoped>
.search-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
  max-width: 720px;
}
.search-row input,
.search-row select {
  font: inherit;
  font-size: 15px;
  padding: 8px 12px;
  border: 1px solid #fff;
  border-radius: 4px;
  background: #fff;
  color: var(--text-primary);
}
.search-row input {
  flex: 1 1 200px;
  min-width: 0;
}
.search-row select {
  flex: 0 1 180px;
  min-width: 0;
}
.search-row .btn {
  flex: none;
}
.search-hint {
  font-size: 14px;
  color: var(--on-dark-muted);
  margin-top: 10px;
}
.search-hint code {
  font-family: var(--mono);
  font-size: 13px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #1d4a7a;
  color: #fff;
}
.api-hub {
  margin-top: 24px;
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 110ch;
}
.api-hub a {
  color: var(--brand);
}
.api-hub code {
  font-family: var(--mono);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.notice {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-secondary);
}
</style>
