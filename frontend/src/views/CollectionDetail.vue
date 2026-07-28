<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <!-- Header (from gateway collection summary) -->
      <div style="margin-bottom: 28px">
        <router-link to="/collections" class="back-link">← All Collections</router-link>

        <template v-if="summary">
          <h1 class="col-title">{{ summary.title || name }}</h1>
          <p v-if="summary.description" class="col-desc">{{ summary.description }}</p>

          <!-- Stats -->
          <div class="col-stats">
            <div class="col-stat">
              <div class="stat-value" style="font-size: 24px">{{ formatBig(datasetCount) }}</div>
              <div class="stat-label">Datasets</div>
            </div>
            <div v-if="summary.stats && summary.stats.total_peptides" class="col-stat">
              <div class="stat-value" style="font-size: 24px">{{ formatBig(summary.stats.total_peptides) }}</div>
              <div class="stat-label">Peptides</div>
            </div>
            <div v-if="summary.stats && summary.stats.total_proteins" class="col-stat">
              <div class="stat-value" style="font-size: 24px">{{ formatBig(summary.stats.total_proteins) }}</div>
              <div class="stat-label">Proteins</div>
            </div>
            <!-- Quantification collections report Features (quantified precursors);
                 identification-only collections (e.g. msnet) have no feature table,
                 so they fall back to the PSM count. -->
            <div v-if="summary.stats && summary.stats.total_features" class="col-stat">
              <div class="stat-value" style="font-size: 24px">{{ formatBig(summary.stats.total_features) }}</div>
              <div class="stat-label">Features</div>
            </div>
            <div v-else-if="summary.stats && summary.stats.total_psms" class="col-stat">
              <div class="stat-value" style="font-size: 24px">{{ formatBig(summary.stats.total_psms) }}</div>
              <div class="stat-label">PSMs</div>
            </div>
            <div v-if="summary.stats && summary.stats.total_samples" class="col-stat">
              <div class="stat-value" style="font-size: 24px">{{ formatBig(summary.stats.total_samples) }}</div>
              <div class="stat-label">Samples</div>
            </div>
            <div v-if="summary.stats && summary.stats.total_size" class="col-stat">
              <div class="stat-value" style="font-size: 24px">{{ formatBytes(summary.stats.total_size) }}</div>
              <div class="stat-label">Size</div>
            </div>
            <div v-if="organisms.length" class="col-stat">
              <div class="stat-value" style="font-size: 24px">{{ organisms.length }}</div>
              <div class="stat-label">Organisms</div>
            </div>
          </div>

          <!-- Organism chips -->
          <div v-if="organisms.length" class="org-chips">
            <span v-for="org in organisms" :key="org" class="tag tag-indigo">{{ org }}</span>
          </div>
        </template>

        <div v-else-if="summaryError" class="notice" style="margin-top: 16px">
          Collection summary is temporarily unavailable.
          <button class="page-btn" style="margin-left: 12px" @click="loadSummary">Retry</button>
        </div>
        <div v-else class="col-title-skeleton"></div>
      </div>

      <!-- Sort control -->
      <div class="filter-bar">
        <div class="filter-group">
          <label class="sort-label">Sort by</label>
          <select v-model="sort" class="facet-select" @change="reload">
            <option value="peptides">Peptides</option>
            <option value="proteins">Proteins</option>
            <option value="samples">Samples</option>
            <option value="size">Size</option>
            <option value="accession">Accession</option>
          </select>
        </div>
        <span v-if="total != null" class="result-count">{{ total.toLocaleString() }} datasets</span>
      </div>

      <!-- Datasets: loading -->
      <div v-if="loadingRows" class="loading-block">Loading datasets…</div>

      <!-- Datasets: error -->
      <div v-else-if="rowsError" class="notice">
        Dataset list is temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="reload">Retry</button>
      </div>

      <!-- Datasets table -->
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import DatasetResultsTable from '../components/DatasetResultsTable.vue'
import { apiGet } from '../api.js'
import { GATEWAY_BASE, DATASET_SEARCH_BASE } from '../config.js'
import { formatBig, formatBytes } from '../utils/format.js'

const route = useRoute()
const name = ref(route.params.name)

const summary = ref(null)
const summaryError = ref(false)

const rows = ref([])
const total = ref(null)
const totalPages = ref(1)
const page = ref(1)
const sort = ref('peptides')
const loadingRows = ref(true)
const rowsError = ref(false)

const organisms = computed(() => (summary.value && summary.value.organisms) || [])
const datasetCount = computed(() => {
  if (total.value != null) return total.value
  return (summary.value && summary.value.stats && summary.value.stats.datasets) || 0
})

async function loadSummary() {
  summaryError.value = false
  summary.value = null
  try {
    summary.value = await apiGet(GATEWAY_BASE, `/collections/${name.value}`)
  } catch (e) {
    summaryError.value = true
  }
}

async function loadRows() {
  loadingRows.value = true
  rowsError.value = false
  try {
    const data = await apiGet(DATASET_SEARCH_BASE, '/datasets', {
      collection: name.value,
      sort: sort.value,
      page: page.value,
    })
    rows.value = data.datasets || []
    total.value = data.total ?? rows.value.length
    totalPages.value = data.total_pages || 1
  } catch (e) {
    rowsError.value = true
  } finally {
    loadingRows.value = false
  }
}

function reload() {
  page.value = 1
  loadRows()
}
function onSort(key) {
  sort.value = key
  reload()
}
function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  loadRows()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function boot() {
  name.value = route.params.name
  page.value = 1
  sort.value = 'peptides'
  loadSummary()
  loadRows()
}

onMounted(boot)
watch(() => route.params.name, boot)
</script>

<style scoped>
.back-link {
  font-size: 13px;
  color: var(--text-muted);
  text-decoration: none;
}
.col-title {
  font-size: 28px;
  font-weight: 800;
  margin-top: 12px;
  margin-bottom: 6px;
}
.col-desc {
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 720px;
  margin-bottom: 20px;
}
.col-stats {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.org-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.sort-label {
  font-size: 13px;
  color: var(--text-muted);
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
.loading-block {
  text-align: center;
  padding: 48px 0;
  color: var(--text-muted);
}
.notice {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-secondary);
}
.col-title-skeleton {
  height: 40px;
  width: 320px;
  border-radius: 8px;
  background: var(--bg-alt);
  margin-top: 12px;
}
</style>
