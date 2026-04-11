<template>
  <div>
    <div v-if="searchable" class="filter-bar">
      <div class="filter-group">
        <input
          v-model="searchQuery"
          type="text"
          class="filter-search"
          placeholder="Search accession or title..."
        />
      </div>
      <span class="result-count">{{ filteredDatasets.length }} dataset{{ filteredDatasets.length !== 1 ? 's' : '' }}</span>
    </div>

    <div v-if="loading" style="text-align:center; padding: 48px 0; color: var(--text-muted);">
      Loading datasets…
    </div>

    <div v-else class="dataset-table-wrap">
      <table class="dataset-table">
        <thead>
          <tr>
            <th @click="sortBy('accession')" style="cursor:pointer; user-select:none;">
              Accession <span class="sort-icon">{{ sortIcon('accession') }}</span>
            </th>
            <th @click="sortBy('title')" style="cursor:pointer; user-select:none;">
              Title <span class="sort-icon">{{ sortIcon('title') }}</span>
            </th>
            <template v-if="isMsnet">
              <th @click="sortBy('species')" style="cursor:pointer; user-select:none; text-align:left;">
                Species <span class="sort-icon">{{ sortIcon('species') }}</span>
              </th>
              <th @click="sortBy('instrument')" style="cursor:pointer; user-select:none; text-align:left;">
                Instrument <span class="sort-icon">{{ sortIcon('instrument') }}</span>
              </th>
              <th @click="sortBy('psm_count')" style="cursor:pointer; user-select:none; text-align:right;">
                PSMs <span class="sort-icon">{{ sortIcon('psm_count') }}</span>
              </th>
              <th @click="sortBy('runs')" style="cursor:pointer; user-select:none; text-align:right;">
                Runs <span class="sort-icon">{{ sortIcon('runs') }}</span>
              </th>
            </template>
            <template v-else>
              <th @click="sortBy('samples')" style="cursor:pointer; user-select:none; text-align:right;">
                Samples <span class="sort-icon">{{ sortIcon('samples') }}</span>
              </th>
              <th @click="sortBy('runs')" style="cursor:pointer; user-select:none; text-align:right;">
                Runs <span class="sort-icon">{{ sortIcon('runs') }}</span>
              </th>
              <th @click="sortBy('proteins')" style="cursor:pointer; user-select:none; text-align:right;">
                Proteins <span class="sort-icon">{{ sortIcon('proteins') }}</span>
              </th>
              <th @click="sortBy('peptides')" style="cursor:pointer; user-select:none; text-align:right;">
                Peptides <span class="sort-icon">{{ sortIcon('peptides') }}</span>
              </th>
            </template>
          </tr>
          <!-- Filter row for MSNet collections -->
          <tr v-if="isMsnet" class="filter-row">
            <th></th>
            <th></th>
            <th>
              <select v-model="filterSpecies" class="col-filter">
                <option value="">All</option>
                <option v-for="s in uniqueSpecies" :key="s" :value="s">{{ s }}</option>
              </select>
            </th>
            <th>
              <select v-model="filterInstrument" class="col-filter">
                <option value="">All</option>
                <option v-for="i in uniqueInstruments" :key="i" :value="i">{{ i }}</option>
              </select>
            </th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredDatasets.length === 0">
            <td :colspan="isMsnet ? 6 : 6" style="text-align:center; padding: 32px; color: var(--text-muted);">
              No datasets found.
            </td>
          </tr>
          <tr
            v-for="ds in sortedDatasets"
            :key="ds.accession + (ds._idx || '')"
            style="cursor:pointer;"
            @click="navigateTo(ds)"
          >
            <td>
              <a v-if="ds.ftp_url"
                :href="ds.ftp_url"
                target="_blank"
                class="accession-link"
                @click.stop
                :title="'Open FTP: ' + ds.accession"
              >
                {{ ds.accession }} <span style="font-size:10px;opacity:0.5;">&#8599;</span>
              </a>
              <router-link v-else
                :to="`/collections/${collectionName}/${ds.accession}`"
                class="accession-link"
                @click.stop
              >
                {{ ds.accession }}
              </router-link>
            </td>
            <td class="td-title">{{ ds.title || ds.accession }}</td>
            <template v-if="isMsnet">
              <td>
                <span v-if="ds.species" class="tag tag-blue" style="font-size:11px;">{{ ds.species }}</span>
                <span v-else-if="ds.organisms && ds.organisms[0]" class="tag tag-blue" style="font-size:11px;">{{ ds.organisms[0] }}</span>
                <span v-else style="color:var(--text-muted);">—</span>
              </td>
              <td style="font-size:13px; color: var(--text-secondary);">{{ ds.instrument || '—' }}</td>
              <td class="td-num">{{ formatNum(ds.psm_count) }}</td>
              <td class="td-num">{{ formatNum(ds.runs) }}</td>
            </template>
            <template v-else>
              <td class="td-num">{{ formatNum(ds.samples) }}</td>
              <td class="td-num">{{ formatNum(ds.runs) }}</td>
              <td class="td-num">{{ formatNum(ds.proteins) }}</td>
              <td class="td-num">{{ formatNum(ds.peptides) }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  datasets: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  searchable: { type: Boolean, default: true },
  collectionName: { type: String, default: '' },
})

const router = useRouter()
const searchQuery = ref('')
const sortKey = ref('accession')
const sortDir = ref(1)

// Column filters (MSNet only)
const filterSpecies = ref('')
const filterInstrument = ref('')

const isMsnet = computed(() => props.collectionName === 'msnet')

// Numeric columns that must be sorted numerically
const NUMERIC_COLS = new Set(['psm_count', 'runs', 'samples', 'proteins', 'peptides'])

// Reset column filters when collection changes
watch(() => props.collectionName, () => {
  filterSpecies.value = ''
  filterInstrument.value = ''
  searchQuery.value = ''
})

// Unique sorted values for dropdowns — derived from raw dataset (before any filter)
const uniqueSpecies = computed(() => {
  const vals = new Set()
  for (const ds of props.datasets) {
    const s = ds.species || (ds.organisms && ds.organisms[0]) || ''
    if (s) vals.add(s)
  }
  return [...vals].sort((a, b) => a.localeCompare(b))
})

const uniqueInstruments = computed(() => {
  const vals = new Set()
  for (const ds of props.datasets) {
    if (ds.instrument) vals.add(ds.instrument)
  }
  return [...vals].sort((a, b) => a.localeCompare(b))
})

const filteredDatasets = computed(() => {
  let result = props.datasets

  // 1. Apply column filters first (MSNet only)
  if (isMsnet.value) {
    if (filterSpecies.value) {
      result = result.filter(ds => {
        const s = ds.species || (ds.organisms && ds.organisms[0]) || ''
        return s === filterSpecies.value
      })
    }
    if (filterInstrument.value) {
      result = result.filter(ds => ds.instrument === filterInstrument.value)
    }
  }

  // 2. Apply text search
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    result = result.filter(ds =>
      (ds.accession || '').toLowerCase().includes(q) ||
      (ds.title || '').toLowerCase().includes(q) ||
      (ds.species || '').toLowerCase().includes(q) ||
      (ds.instrument || '').toLowerCase().includes(q)
    )
  }

  return result
})

const sortedDatasets = computed(() => {
  const arr = [...filteredDatasets.value]
  const key = sortKey.value
  const dir = sortDir.value

  arr.sort((a, b) => {
    let av = a[key] ?? ''
    let bv = b[key] ?? ''

    // Force numeric comparison for known numeric columns or when values parse as numbers
    if (NUMERIC_COLS.has(key)) {
      const na = Number(av)
      const nb = Number(bv)
      const aIsNum = !isNaN(na)
      const bIsNum = !isNaN(nb)
      if (aIsNum && bIsNum) return (na - nb) * dir
      if (aIsNum) return -1 * dir   // numbers before empties
      if (bIsNum) return 1 * dir
      return 0
    }

    // Also handle the case where both values happen to be numbers (non-numeric-column edge case)
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir

    return String(av).localeCompare(String(bv)) * dir
  })
  return arr
})

function sortBy(key) {
  if (sortKey.value === key) {
    sortDir.value *= -1
  } else {
    sortKey.value = key
    sortDir.value = 1
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === 1 ? '↑' : '↓'
}

function formatNum(n) {
  if (n === null || n === undefined || n === 0) return '—'
  return Number(n).toLocaleString()
}

function navigateTo(ds) {
  router.push(`/collections/${props.collectionName}/${ds.accession}`)
}
</script>

<style scoped>
.sort-icon {
  font-size: 11px;
  opacity: 0.5;
  margin-left: 2px;
}

.filter-row th {
  padding: 4px 8px;
  background: var(--bg-secondary, #f5f5f5);
}

.col-filter {
  width: 100%;
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
  cursor: pointer;
  outline: none;
}

.col-filter:focus {
  border-color: var(--accent-color, #4a90e2);
}
</style>
