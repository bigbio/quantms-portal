<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">
      <div class="section-header">
        <h2>All Collections</h2>
        <p>Curated groups of datasets, each with specialized indexes and services</p>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar" style="margin-bottom: 28px;">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="tabCount(tab.key)" style="margin-left:5px; font-size:11px; opacity:0.65;">({{ tabCount(tab.key) }})</span>
        </button>
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
        <span class="result-count">{{ filteredDatasets.length }} dataset{{ filteredDatasets.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Loading -->
      <div v-if="loading" style="text-align:center; padding: 64px 0; color: var(--text-muted);">
        Loading datasets…
      </div>

      <!-- Table per active collection -->
      <template v-else>
        <div v-if="activeTab !== 'all'" style="margin-bottom:12px;">
          <div v-if="activeCollection" style="display:flex; gap:24px; margin-bottom:20px; flex-wrap:wrap;">
            <div v-for="(val, key) in activeCollection.stats" :key="key" style="text-align:center;">
              <div class="stat-value" style="font-size:20px;">{{ formatBig(val) }}</div>
              <div class="stat-label">{{ formatLabel(key) }}</div>
            </div>
          </div>
        </div>

        <DatasetTable
          :datasets="filteredDatasets"
          :loading="false"
          :searchable="false"
          :collection-name="activeTab === 'all' ? '' : activeTab"
        />

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import DatasetTable from '../components/DatasetTable.vue'

const tabs = [
  { key: 'all', label: 'All Datasets' },
  { key: 'absolute-expression', label: 'Absolute Expression' },
  { key: 'differential-expression', label: 'Differential Expression' },
  { key: 'msnet', label: 'MS-Net' },
  { key: 'single-cell', label: 'Single Cell' },
]

const activeTab = ref('all')
const searchQuery = ref('')
const loading = ref(false)
const collections = ref([])
// Map: collectionName -> { pages: {1: [...], 2: [...]}, totalPages }
const collectionData = ref({})
const currentPage = ref(1)

const activeCollection = computed(() =>
  activeTab.value === 'all' ? null : (collections.value.find(c => c.name === activeTab.value) || null)
)

const totalPages = computed(() => {
  if (activeTab.value === 'all') return 1
  return collectionData.value[activeTab.value]?.totalPages || 1
})

const currentPageDatasets = computed(() => {
  if (activeTab.value === 'all') {
    // Aggregate page 1 from all collections
    const all = []
    for (const col of collections.value) {
      const pages = collectionData.value[col.name]?.pages || {}
      const p1 = pages[1] || []
      p1.forEach(ds => all.push({ ...ds, _collection: col.name }))
    }
    return all
  }
  const pages = collectionData.value[activeTab.value]?.pages || {}
  return pages[currentPage.value] || []
})

const filteredDatasets = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return currentPageDatasets.value
  return currentPageDatasets.value.filter(ds =>
    (ds.accession || '').toLowerCase().includes(q) ||
    (ds.title || '').toLowerCase().includes(q) ||
    (ds.species || '').toLowerCase().includes(q)
  )
})

function tabCount(key) {
  if (key === 'all') {
    return collections.value.reduce((s, c) => s + (c.dataset_count || 0), 0)
  }
  const col = collections.value.find(c => c.name === key)
  return col ? col.dataset_count : 0
}

function formatBig(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function formatLabel(key) {
  return key.replace(/^total_/, '').replace(/_/g, ' ')
}

async function loadCollectionPage(name, page) {
  if (collectionData.value[name]?.pages?.[page]) return
  try {
    const res = await fetch(`./data/collections/${name}/datasets-page-${page}.json`)
    const data = await res.json()
    if (!collectionData.value[name]) {
      collectionData.value[name] = { totalPages: data.total_pages, pages: {} }
    }
    collectionData.value[name].pages[page] = data.datasets || []
    collectionData.value[name].totalPages = data.total_pages || 1
  } catch (e) {
    console.warn(`Could not load ${name} page ${page}:`, e)
  }
}

async function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
  await loadCollectionPage(activeTab.value, p)
}

watch(activeTab, async (tab) => {
  currentPage.value = 1
  searchQuery.value = ''
  if (tab === 'all') {
    // Ensure page 1 of all collections is loaded
    for (const col of collections.value) {
      await loadCollectionPage(col.name, 1)
    }
  } else {
    await loadCollectionPage(tab, 1)
  }
})

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetch('./data/registry.json')
    const data = await res.json()
    collections.value = data.collections || []
    // Load page 1 for all collections
    for (const col of collections.value) {
      await loadCollectionPage(col.name, 1)
    }
  } catch (e) {
    console.warn('Could not load registry.json:', e)
  } finally {
    loading.value = false
  }
})
</script>
