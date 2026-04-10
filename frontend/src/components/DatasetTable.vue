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
import { ref, computed } from 'vue'
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

const isMsnet = computed(() => props.collectionName === 'msnet')

const filteredDatasets = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.datasets
  return props.datasets.filter(ds =>
    (ds.accession || '').toLowerCase().includes(q) ||
    (ds.title || '').toLowerCase().includes(q) ||
    (ds.species || '').toLowerCase().includes(q) ||
    (ds.instrument || '').toLowerCase().includes(q)
  )
})

const sortedDatasets = computed(() => {
  const arr = [...filteredDatasets.value]
  arr.sort((a, b) => {
    let av = a[sortKey.value] ?? ''
    let bv = b[sortKey.value] ?? ''
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir.value
    return String(av).localeCompare(String(bv)) * sortDir.value
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
</style>
