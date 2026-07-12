<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="section-header" style="text-align: left; margin-bottom: 20px">
        <h2>Dataset Search</h2>
        <p style="margin: 0">
          Search and browse every quantms dataset across all collections — peptides, proteins,
          instrument and downloads in one table. Click a row to expand its details.
        </p>
      </div>

      <!-- Stats ribbon -->
      <div class="ds-totals">
        <div><div class="stat-value" style="font-size: 24px">{{ formatBig(totalDatasets) }}</div><div class="stat-label">Datasets</div></div>
        <div><div class="stat-value" style="font-size: 24px">{{ formatBig(collectionCount) }}</div><div class="stat-label">Collections</div></div>
        <div><div class="stat-value" style="font-size: 24px">{{ formatBig(totalPeptides) }}</div><div class="stat-label">Peptides</div></div>
        <div><div class="stat-value" style="font-size: 24px">{{ formatBig(totalProteins) }}</div><div class="stat-label">Proteins</div></div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar" style="align-items: flex-start">
        <div class="filter-group">
          <input
            v-model="q"
            type="text"
            class="filter-search"
            style="width: 280px"
            placeholder="Search title, summary, keywords…"
            @keyup.enter="reload"
          />
          <select v-model="collection" class="facet-select" @change="reload">
            <option value="">All collections</option>
            <option v-for="c in facetCollections" :key="c.name" :value="c.name">{{ c.title }}</option>
          </select>
          <select v-model="organism" class="facet-select" @change="reload">
            <option value="">All organisms</option>
            <option v-for="o in facetOrganisms" :key="o.value" :value="o.value">{{ o.value }} ({{ o.datasets }})</option>
          </select>
          <select v-model="instrument" class="facet-select" @change="reload">
            <option value="">All instruments</option>
            <option v-for="i in facetInstruments" :key="i.value" :value="i.value">{{ cleanInstrument(i.value) }}</option>
          </select>
          <button class="page-btn primary" style="padding: 8px 16px" @click="reload">Search</button>
          <button v-if="hasFilters" class="page-btn" style="padding: 8px 14px" @click="clearFilters">Clear</button>
        </div>
        <span v-if="total != null" class="result-count">{{ total.toLocaleString() }} results</span>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-block">Searching datasets…</div>

      <!-- Error -->
      <div v-else-if="error" class="notice">
        Dataset search is temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="reload">Retry</button>
      </div>

      <!-- Results -->
      <template v-else>
        <DatasetResultsTable :datasets="rows" :sort="sort" @sort="onSort" />

        <div v-if="totalPages > 1" class="pagination">
          <button class="page-btn" :class="{ disabled: page === 1 }" :disabled="page === 1" @click="goPage(page - 1)">← Prev</button>
          <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
          <button class="page-btn" :class="{ disabled: page === totalPages }" :disabled="page === totalPages" @click="goPage(page + 1)">Next →</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import DatasetResultsTable from '../components/DatasetResultsTable.vue'
import { apiGet } from '../api.js'
import { DATASET_SEARCH_BASE, PEPTIDE_SEARCH_BASE } from '../config.js'
import { formatBig, cleanInstrument } from '../utils/format.js'

const route = useRoute()

const q = ref(route.query.q || '')
const collection = ref(route.query.collection || '')
const organism = ref(route.query.organism || '')
const instrument = ref('')
const sort = ref('peptides')
const page = ref(1)

const rows = ref([])
const total = ref(null)
const totalPages = ref(1)
const loading = ref(true)
const error = ref(false)

// Facet sources
const facetCollections = ref([])
const facetOrganisms = ref([])
const facetInstruments = ref([])
const collectionStats = ref([])

const collectionCount = computed(() => facetCollections.value.length)
const totalDatasets = computed(() => total.value ?? 0)
const totalPeptides = computed(() => collectionStats.value.reduce((s, c) => s + (c.total_peptides || 0), 0))
const totalProteins = computed(() => collectionStats.value.reduce((s, c) => s + (c.total_proteins || 0), 0))

const hasFilters = computed(() => !!(q.value || collection.value || organism.value || instrument.value))

async function loadFacets() {
  // Collections (with titles + headline stats) from dataset-search.
  try {
    const data = await apiGet(DATASET_SEARCH_BASE, '/collections')
    collectionStats.value = data.collections || []
    facetCollections.value = (data.collections || []).map((c) => ({ name: c.name, title: c.title || c.name }))
    // organism facet: union across collections
    const orgSet = new Map()
    for (const c of data.collections || []) {
      for (const o of c.organisms || []) orgSet.set(o, (orgSet.get(o) || 0) + 1)
    }
    facetOrganisms.value = [...orgSet.keys()].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, datasets: '' }))
  } catch (e) {
    // facets are best-effort; leave empty on failure
  }
  // instrument + organism-with-counts from peptide-search facets (same dataset universe)
  try {
    const f = await apiGet(PEPTIDE_SEARCH_BASE, '/facets')
    if (Array.isArray(f.instrument)) facetInstruments.value = f.instrument
    if (Array.isArray(f.organism) && f.organism.length) facetOrganisms.value = f.organism
  } catch (e) {
    // ignore
  }
}

async function load() {
  loading.value = true
  error.value = false
  try {
    const data = await apiGet(DATASET_SEARCH_BASE, '/datasets', {
      q: q.value || undefined,
      collection: collection.value || undefined,
      organism: organism.value || undefined,
      instrument: instrument.value || undefined,
      sort: sort.value,
      page: page.value,
    })
    rows.value = data.datasets || []
    total.value = data.total ?? rows.value.length
    totalPages.value = data.total_pages || 1
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  load()
}
function onSort(key) {
  sort.value = key
  reload()
}
function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function clearFilters() {
  q.value = ''
  collection.value = ''
  organism.value = ''
  instrument.value = ''
  reload()
}

onMounted(() => {
  loadFacets()
  load()
})
</script>

<style scoped>
.ds-totals {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.facet-select {
  font-family: var(--font);
  font-size: 13px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
}
.facet-select:focus {
  border-color: var(--indigo);
}
.page-btn.primary {
  background: var(--indigo);
  color: #fff;
  border-color: var(--indigo);
}
.loading-block {
  text-align: center;
  padding: 56px 0;
  color: var(--text-muted);
}
.notice {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-secondary);
}
</style>
