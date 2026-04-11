<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">
      <template v-if="collection">
        <!-- Header -->
        <div style="margin-bottom: 32px;">
          <router-link to="/collections" style="font-size:13px; color:var(--text-muted); text-decoration:none;">
            ← All Collections
          </router-link>
          <h1 style="font-size: 28px; font-weight: 800; margin-top: 12px; margin-bottom: 6px;">
            {{ collection.title }}
          </h1>
          <p style="color: var(--text-secondary); font-size: 15px; max-width: 700px; margin-bottom: 20px;">
            {{ collection.description }}
          </p>
          <!-- Stats -->
          <div style="display:flex; gap:32px; flex-wrap:wrap;">
            <div style="text-align:left;">
              <div class="stat-value" style="font-size:24px;">{{ collection.dataset_count }}</div>
              <div class="stat-label">Datasets</div>
            </div>
            <template v-for="(val, key) in collection.stats" :key="key">
              <div v-if="typeof val === 'number'" style="text-align:left;">
                <div class="stat-value" style="font-size:24px;">{{ formatBig(val) }}</div>
                <div class="stat-label">{{ formatLabel(key) }}</div>
              </div>
            </template>
            <div v-if="collection.organisms && collection.organisms.length" style="text-align:left;">
              <div class="stat-value" style="font-size:24px;">{{ collection.organisms.length }}</div>
              <div class="stat-label">Organisms</div>
            </div>
          </div>
          <!-- FTP link -->
          <div v-if="collection.ftp_url" style="margin-top: 16px;">
            <a :href="collection.ftp_url" target="_blank" class="btn btn-outline" style="font-size: 13px; padding: 8px 18px; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Browse FTP Directory
            </a>
          </div>
        </div>

        <!-- Organisms -->
        <div v-if="collection.organisms && collection.organisms.length" style="margin-bottom:24px; display:flex; gap:8px; flex-wrap:wrap;">
          <span
            v-for="org in collection.organisms"
            :key="org"
            class="tag tag-indigo"
          >{{ org }}</span>
        </div>

        <!-- Filter bar -->
        <div class="filter-bar">
          <div class="filter-group">
            <input
              v-model="searchQuery"
              type="text"
              class="filter-search"
              placeholder="Search accession or title…"
            />
          </div>
          <span class="result-count">
            {{ allDatasets.length }} total — showing {{ filteredDatasets.length }}
          </span>
        </div>

        <!-- Loading -->
        <div v-if="loading" style="text-align:center; padding: 48px 0; color: var(--text-muted);">
          Loading datasets…
        </div>

        <DatasetTable
          v-else
          :datasets="filteredDatasets"
          :loading="false"
          :searchable="false"
          :collection-name="collection.name"
        />

        <!-- Pagination -->
        <div v-if="!loading && totalPages > 1" class="pagination">
          <button
            class="page-btn"
            :class="{ disabled: currentPage === 1 }"
            :disabled="currentPage === 1"
            @click="goPage(currentPage - 1)"
          >← Prev</button>
          <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
          <button
            class="page-btn"
            :class="{ disabled: currentPage === totalPages }"
            :disabled="currentPage === totalPages"
            @click="goPage(currentPage + 1)"
          >Next →</button>
        </div>
      </template>

      <template v-else-if="notFound">
        <div class="placeholder-page">
          <span class="placeholder-icon">📁</span>
          <h1>Collection not found</h1>
          <p>The collection "{{ $route.params.name }}" could not be found in the registry.</p>
          <router-link to="/collections" class="btn btn-primary" style="margin-top:20px; display:inline-flex;">
            ← Back to Collections
          </router-link>
        </div>
      </template>

      <template v-else>
        <div style="text-align:center; padding: 80px 0; color: var(--text-muted);">Loading…</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import DatasetTable from '../components/DatasetTable.vue'

const route = useRoute()
const collection = ref(null)
const notFound = ref(false)
const loading = ref(false)
const searchQuery = ref('')

// Paged data: { 1: [...], 2: [...] }
const pages = ref({})
const currentPage = ref(1)
const totalPages = ref(1)

const currentPageDatasets = computed(() => pages.value[currentPage.value] || [])

const allDatasets = computed(() => currentPageDatasets.value)

const filteredDatasets = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return allDatasets.value
  return allDatasets.value.filter(ds =>
    (ds.accession || '').toLowerCase().includes(q) ||
    (ds.title || '').toLowerCase().includes(q) ||
    (ds.species || '').toLowerCase().includes(q)
  )
})

function formatBig(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString()
}

function formatLabel(key) {
  return key.replace(/^total_/, '').replace(/_/g, ' ')
}

async function loadPage(name, page) {
  if (pages.value[page]) return
  try {
    const res = await fetch(`./data/collections/${name}/datasets-page-${page}.json`)
    const data = await res.json()
    pages.value[page] = data.datasets || []
    totalPages.value = data.total_pages || 1
  } catch (e) {
    console.warn(`Could not load page ${page}:`, e)
  }
}

async function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
  loading.value = true
  await loadPage(route.params.name, p)
  loading.value = false
}

onMounted(async () => {
  const name = route.params.name
  loading.value = true
  try {
    const res = await fetch('./data/registry.json')
    const data = await res.json()
    collection.value = (data.collections || []).find(c => c.name === name) || null
    if (!collection.value) {
      notFound.value = true
      return
    }
    await loadPage(name, 1)
  } catch (e) {
    console.warn('Could not load collection:', e)
    notFound.value = true
  } finally {
    loading.value = false
  }
})
</script>
