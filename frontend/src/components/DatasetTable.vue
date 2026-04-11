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
      <span class="result-count">{{ rows.length }} dataset{{ rows.length !== 1 ? 's' : '' }}</span>
    </div>

    <div v-if="loading" style="text-align:center; padding: 48px 0; color: var(--text-muted);">
      Loading datasets…
    </div>

    <div v-else class="dataset-table-wrap">
      <table class="dataset-table">
        <thead>
          <tr>
            <th class="sortable" @click="clickSort('accession')">
              Accession {{ icon('accession') }}
            </th>
            <th class="sortable" @click="clickSort('title')">
              Title {{ icon('title') }}
            </th>
            <template v-if="isMsnet">
              <th class="sortable" @click="clickSort('species')">
                Species {{ icon('species') }}
              </th>
              <th class="sortable" @click="clickSort('instrument')">
                Instrument {{ icon('instrument') }}
              </th>
              <th class="sortable num" @click="clickSort('psm_count')">
                PSMs {{ icon('psm_count') }}
              </th>
              <th class="sortable num" @click="clickSort('runs')">
                Runs {{ icon('runs') }}
              </th>
            </template>
            <template v-else>
              <th class="sortable num" @click="clickSort('samples')">
                Samples {{ icon('samples') }}
              </th>
              <th class="sortable num" @click="clickSort('runs')">
                Runs {{ icon('runs') }}
              </th>
              <th class="sortable num" @click="clickSort('proteins')">
                Proteins {{ icon('proteins') }}
              </th>
              <th class="sortable num" @click="clickSort('peptides')">
                Peptides {{ icon('peptides') }}
              </th>
            </template>
          </tr>
          <tr v-if="isMsnet" class="filter-row">
            <th></th>
            <th></th>
            <th>
              <select v-model="filterSpecies" class="col-filter">
                <option value="">All species</option>
                <option v-for="s in uniqueSpecies" :key="s" :value="s">{{ s }}</option>
              </select>
            </th>
            <th>
              <select v-model="filterInstrument" class="col-filter">
                <option value="">All instruments</option>
                <option v-for="i in uniqueInstruments" :key="i" :value="i">{{ i }}</option>
              </select>
            </th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td :colspan="isMsnet ? 6 : 6" style="text-align:center; padding: 32px; color: var(--text-muted);">
              No datasets found.
            </td>
          </tr>
          <tr
            v-for="(ds, idx) in rows"
            :key="ds.accession + '-' + idx"
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
              <td class="td-num">{{ fmtNum(ds.psm_count) }}</td>
              <td class="td-num">{{ fmtNum(ds.runs) }}</td>
            </template>
            <template v-else>
              <td class="td-num">{{ fmtNum(ds.samples) }}</td>
              <td class="td-num">{{ fmtNum(ds.runs) }}</td>
              <td class="td-num">{{ fmtNum(ds.proteins) }}</td>
              <td class="td-num">{{ fmtNum(ds.peptides) }}</td>
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
const filterSpecies = ref('')
const filterInstrument = ref('')

// Sort state: key='' means unsorted
const sKey = ref('')
const sAsc = ref(true)

const isMsnet = computed(() => props.collectionName === 'msnet')
const NUM = new Set(['psm_count', 'runs', 'samples', 'proteins', 'peptides'])

watch(() => props.collectionName, () => {
  filterSpecies.value = ''
  filterInstrument.value = ''
  searchQuery.value = ''
  sKey.value = ''
})

const uniqueSpecies = computed(() => {
  const s = new Set()
  props.datasets.forEach(d => {
    const v = d.species || (d.organisms && d.organisms[0]) || ''
    if (v) s.add(v)
  })
  return [...s].sort()
})

const uniqueInstruments = computed(() => {
  const s = new Set()
  props.datasets.forEach(d => { if (d.instrument) s.add(d.instrument) })
  return [...s].sort()
})

// Final rows: filter → search → sort
const rows = computed(() => {
  let arr = props.datasets.slice()

  // Column filters
  if (isMsnet.value && filterSpecies.value) {
    arr = arr.filter(d => (d.species || (d.organisms && d.organisms[0]) || '') === filterSpecies.value)
  }
  if (isMsnet.value && filterInstrument.value) {
    arr = arr.filter(d => d.instrument === filterInstrument.value)
  }

  // Text search
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    arr = arr.filter(d =>
      (d.accession || '').toLowerCase().includes(q) ||
      (d.title || '').toLowerCase().includes(q) ||
      (d.species || '').toLowerCase().includes(q)
    )
  }

  // Sort
  const k = sKey.value
  if (!k) return arr

  const asc = sAsc.value
  const numeric = NUM.has(k)

  return arr.slice().sort((a, b) => {
    const va = a[k]
    const vb = b[k]

    if (numeric) {
      const na = typeof va === 'number' ? va : (va ? parseFloat(va) : NaN)
      const nb = typeof vb === 'number' ? vb : (vb ? parseFloat(vb) : NaN)
      const aOk = !isNaN(na) && na > 0
      const bOk = !isNaN(nb) && nb > 0
      if (!aOk && !bOk) return 0
      if (!aOk) return 1    // empty always last
      if (!bOk) return -1
      return asc ? na - nb : nb - na
    }

    const sa = String(va || '')
    const sb = String(vb || '')
    return asc ? sa.localeCompare(sb) : sb.localeCompare(sa)
  })
})

function clickSort(key) {
  if (sKey.value === key) {
    sAsc.value = !sAsc.value
  } else {
    sKey.value = key
    sAsc.value = !NUM.has(key)  // numbers: desc first; text: asc first
  }
}

function icon(key) {
  if (sKey.value !== key) return ' ▲▼'
  return sAsc.value ? ' ▲' : ' ▼'
}

function fmtNum(n) {
  if (n == null || n === 0 || n === '') return '—'
  return Number(n).toLocaleString()
}

function navigateTo(ds) {
  router.push(`/collections/${props.collectionName}/${ds.accession}`)
}
</script>

<style scoped>
.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.sortable:hover {
  color: var(--indigo, #6366f1);
}
.num {
  text-align: right;
}
.filter-row th {
  padding: 4px 8px;
  background: rgba(0,0,0,0.02);
}
.col-filter {
  width: 100%;
  font-size: 11px;
  padding: 3px 4px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 4px;
  background: #fff;
  color: var(--text-primary, #333);
  cursor: pointer;
  outline: none;
}
.col-filter:focus {
  border-color: var(--indigo, #6366f1);
}
</style>
