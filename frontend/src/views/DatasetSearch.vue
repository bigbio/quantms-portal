<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">
      <div class="section-header" style="text-align:left; margin-bottom:24px;">
        <h2>Dataset Search</h2>
        <p style="margin:0;">Search and browse every quantms dataset across all collections — peptides, proteins and download links in one table.</p>
      </div>

      <!-- Stats ribbon -->
      <div style="display:flex; gap:32px; flex-wrap:wrap; margin-bottom:28px;">
        <div>
          <div class="stat-value" style="font-size:24px;">{{ formatBig(totals.datasets) }}</div>
          <div class="stat-label">Datasets</div>
        </div>
        <div>
          <div class="stat-value" style="font-size:24px;">{{ formatBig(totals.collections) }}</div>
          <div class="stat-label">Collections</div>
        </div>
        <div>
          <div class="stat-value" style="font-size:24px;">{{ formatBig(totals.peptides) }}</div>
          <div class="stat-label">Peptides</div>
        </div>
        <div>
          <div class="stat-value" style="font-size:24px;">{{ formatBig(totals.proteins) }}</div>
          <div class="stat-label">Proteins</div>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar" style="align-items:flex-start;">
        <div class="filter-group">
          <input
            v-model="searchQuery"
            type="text"
            class="filter-search"
            style="width:280px;"
            placeholder="Search accession, title or organism…"
          />
          <select v-model="filterCollection" class="facet-select">
            <option value="">All collections</option>
            <option v-for="c in facetCollections" :key="c.name" :value="c.name">{{ c.title }}</option>
          </select>
          <select v-model="filterOrganism" class="facet-select">
            <option value="">All organisms</option>
            <option v-for="o in facetOrganisms" :key="o" :value="o">{{ o }}</option>
          </select>
          <select v-model="filterInstrument" class="facet-select">
            <option value="">All instruments</option>
            <option v-for="i in facetInstruments" :key="i" :value="i">{{ i }}</option>
          </select>
          <button v-if="hasActiveFilters" class="page-btn" style="padding:8px 14px;" @click="clearFilters">Clear filters</button>
        </div>
        <span class="result-count">
          {{ totals.datasets }} datasets — showing {{ filtered.length }}
        </span>
      </div>

      <!-- Loading -->
      <div v-if="loading" style="text-align:center; padding:64px 0; color:var(--text-muted);">
        Loading datasets across all collections…
      </div>

      <template v-else>
        <div class="dataset-table-wrap">
          <table class="dataset-table">
            <thead>
              <tr>
                <th class="sortable" @click="clickSort('accession')">Accession{{ icon('accession') }}</th>
                <th class="sortable" @click="clickSort('_collectionTitle')">Collection{{ icon('_collectionTitle') }}</th>
                <th class="sortable" @click="clickSort('_organism')">Organism{{ icon('_organism') }}</th>
                <th class="sortable" @click="clickSort('instrument')">Instrument{{ icon('instrument') }}</th>
                <th class="sortable num" @click="clickSort('peptides')">Peptides{{ icon('peptides') }}</th>
                <th class="sortable num" @click="clickSort('proteins')">Proteins{{ icon('proteins') }}</th>
                <th class="sortable num" @click="clickSort('_count')">Samples/PSMs{{ icon('_count') }}</th>
                <th class="sortable num" @click="clickSort('_size')">Size{{ icon('_size') }}</th>
                <th style="text-align:center;">Download</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filtered.length === 0">
                <td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">No datasets match your filters.</td>
              </tr>
              <tr v-for="(ds, idx) in pageRows" :key="ds._collection + '-' + ds.accession + '-' + idx">
                <td>
                  <router-link :to="`/collections/${ds._collection}/${ds.accession}`" class="accession-link">{{ ds.accession }}</router-link>
                </td>
                <td><span class="tag" :class="collectionTag(ds._collection)">{{ ds._collectionTitle }}</span></td>
                <td style="font-size:13px;">
                  <span v-if="ds._organism">{{ ds._organism }}</span>
                  <span v-else style="color:var(--text-muted);">—</span>
                </td>
                <td style="font-size:13px; color:var(--text-secondary);">{{ ds.instrument || '—' }}</td>
                <td class="td-num">{{ fmtNum(ds.peptides) }}</td>
                <td class="td-num">{{ fmtNum(ds.proteins) }}</td>
                <td class="td-num">{{ fmtNum(ds._count) }}</td>
                <td class="td-num">{{ ds._size ? formatBytes(ds._size) : '—' }}</td>
                <td style="text-align:center;">
                  <a
                    v-if="downloadUrl(ds)"
                    :href="downloadUrl(ds)"
                    target="_blank"
                    rel="noopener"
                    class="dl-link"
                    :title="'Download ' + ds.accession"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                  <span v-else style="color:var(--text-muted);">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
          <button class="page-btn" :class="{ disabled: currentPage === 1 }" :disabled="currentPage === 1" @click="goPage(currentPage - 1)">← Prev</button>
          <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
          <button class="page-btn" :class="{ disabled: currentPage === totalPages }" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)">Next →</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const collections = ref([])      // from registry.json
const allDatasets = ref([])      // flattened, enriched rows

const searchQuery = ref('')
const filterCollection = ref(route.query.collection || '')
const filterOrganism = ref(route.query.organism || '')
const filterInstrument = ref('')

const sKey = ref('')
const sAsc = ref(true)
const currentPage = ref(1)
const PAGE_SIZE = 50
const NUM = new Set(['peptides', 'proteins', '_count', '_size'])

// ---- load all pages of all collections ----
async function loadCollection(col) {
  const pages = col.total_pages || 1
  const orgFallback = (col.organisms && col.organisms[0]) || ''
  for (let p = 1; p <= pages; p++) {
    try {
      const res = await fetch(`./data/collections/${col.name}/datasets-page-${p}.json`)
      if (!res.ok) continue
      const data = await res.json()
      for (const ds of (data.datasets || [])) {
        const organism = ds.species || (ds.organisms && ds.organisms[0]) || orgFallback
        allDatasets.value.push({
          ...ds,
          _collection: col.name,
          _collectionTitle: col.title || col.name,
          _organism: organism,
          _count: ds.samples && ds.samples > 0 ? ds.samples : (ds.psm_count || 0),
          _size: ds.total_size || ds.size || 0,
        })
      }
    } catch (e) {
      console.warn(`dataset-search: could not load ${col.name} page ${p}:`, e)
    }
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetch('./data/registry.json')
    const data = await res.json()
    collections.value = data.collections || []
    await Promise.all(collections.value.map(loadCollection))
  } catch (e) {
    console.warn('dataset-search: could not load registry.json:', e)
  } finally {
    loading.value = false
  }
})

// ---- totals ----
const totals = computed(() => {
  let peptides = 0, proteins = 0
  for (const c of collections.value) {
    peptides += c.stats?.total_peptides || 0
    proteins += c.stats?.total_proteins || 0
  }
  return {
    datasets: allDatasets.value.length,
    collections: collections.value.length,
    peptides,
    proteins,
  }
})

// ---- facets ----
const facetCollections = computed(() => collections.value.map(c => ({ name: c.name, title: c.title || c.name })))
const facetOrganisms = computed(() => {
  const s = new Set()
  allDatasets.value.forEach(d => { if (d._organism) s.add(d._organism) })
  return [...s].sort((a, b) => a.localeCompare(b))
})
const facetInstruments = computed(() => {
  const s = new Set()
  allDatasets.value.forEach(d => { if (d.instrument) s.add(d.instrument) })
  return [...s].sort((a, b) => a.localeCompare(b))
})

const hasActiveFilters = computed(() =>
  !!(searchQuery.value || filterCollection.value || filterOrganism.value || filterInstrument.value)
)

// ---- filter + sort ----
const filtered = computed(() => {
  let arr = allDatasets.value
  if (filterCollection.value) arr = arr.filter(d => d._collection === filterCollection.value)
  if (filterOrganism.value) arr = arr.filter(d => d._organism === filterOrganism.value)
  if (filterInstrument.value) arr = arr.filter(d => d.instrument === filterInstrument.value)

  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    arr = arr.filter(d =>
      (d.accession || '').toLowerCase().includes(q) ||
      (d.title || '').toLowerCase().includes(q) ||
      (d._organism || '').toLowerCase().includes(q)
    )
  }

  const k = sKey.value
  if (!k) return arr
  const asc = sAsc.value
  const numeric = NUM.has(k)
  return arr.slice().sort((a, b) => {
    if (numeric) {
      const na = Number(a[k]) || 0
      const nb = Number(b[k]) || 0
      const aOk = na > 0, bOk = nb > 0
      if (!aOk && !bOk) return 0
      if (!aOk) return 1
      if (!bOk) return -1
      return asc ? na - nb : nb - na
    }
    return asc
      ? String(a[k] || '').localeCompare(String(b[k] || ''))
      : String(b[k] || '').localeCompare(String(a[k] || ''))
  })
})

// ---- pagination ----
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})
function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
// reset to page 1 whenever the filtered set changes
watch([searchQuery, filterCollection, filterOrganism, filterInstrument, sKey, sAsc], () => {
  currentPage.value = 1
})

// ---- sort helpers ----
function clickSort(key) {
  if (sKey.value === key) { sAsc.value = !sAsc.value }
  else { sKey.value = key; sAsc.value = !NUM.has(key) }
}
function icon(key) {
  if (sKey.value !== key) return ' ▲▼'
  return sAsc.value ? ' ▲' : ' ▼'
}

function clearFilters() {
  searchQuery.value = ''
  filterCollection.value = ''
  filterOrganism.value = ''
  filterInstrument.value = ''
}

// ---- download link (S3 browse folder if hashed, else FTP) ----
function downloadUrl(ds) {
  const hash = ds.hash || (ds.dataset_ref ? String(ds.dataset_ref).split('/')[1] : '')
  if (hash) return `https://browse.quantms.org/quantms/datasets/${ds.accession}/${hash}/`
  return ds.ftp_url || ''
}

function collectionTag(name) {
  switch (name) {
    case 'absolute-expression': return 'tag-indigo'
    case 'differential-expression': return 'tag-violet'
    case 'msnet': return 'tag-blue'
    case 'single-cell': return 'tag-green'
    default: return 'tag-blue'
  }
}

// ---- formatting ----
function fmtNum(n) {
  if (n == null || n === 0 || n === '') return '—'
  return Number(n).toLocaleString()
}
function formatBig(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
function formatBytes(b) {
  if (!b) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = b
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return v.toFixed(v >= 10 || i === 0 ? 0 : 1) + ' ' + u[i]
}
</script>

<style scoped>
.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
.sortable:hover { color: var(--indigo, #6366f1); }
.num { text-align: right; }
.td-num { text-align: right; font-variant-numeric: tabular-nums; }
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
.facet-select:focus { border-color: var(--indigo); }
.dataset-table thead th { position: sticky; top: 0; z-index: 1; }
.dl-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--indigo);
  width: 30px; height: 26px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.dl-link:hover { border-color: var(--indigo); background: rgba(99,102,241,0.06); }
</style>
