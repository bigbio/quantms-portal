<template>
  <div class="pp-peptides">
    <div class="pp-bar">
      <span class="result-count">
        <template v-if="loading">Loading peptides…</template>
        <template v-else>
          {{ formatNum(shown.length) }} peptide<span v-if="shown.length !== 1">s</span>
          <span v-if="data.length">, {{ formatNum(nProteotypic) }} unique to the gene</span>
        </template>
      </span>
      <label class="pp-filter">
        <input v-model="proteotypicOnly" type="checkbox" /> Unique to the gene only
      </label>
    </div>

    <div v-if="!loading" class="dataset-table-wrap">
      <table class="dataset-table">
        <thead>
          <tr>
            <th :aria-sort="ariaSort('start')"><button class="pp-sort" @click="sortBy('start')">Position{{ arrow('start') }}</button></th>
            <th>Peptide</th>
            <th>Peptidoforms</th>
            <th title="All its proteins in the corpus belong to this one gene">Unique</th>
            <th class="num" :aria-sort="ariaSort('n_datasets')"><button class="pp-sort" @click="sortBy('n_datasets')">Datasets{{ arrow('n_datasets') }}</button></th>
            <th class="num" :aria-sort="ariaSort('n_obs')"><button class="pp-sort" @click="sortBy('n_obs')">Obs.{{ arrow('n_obs') }}</button></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!shown.length">
            <td colspan="6" class="pp-empty">No peptides.</td>
          </tr>
          <tr v-for="p in visible" :key="p.sequence">
            <td class="td-num pp-pos">
              <template v-if="p.start">{{ p.start }}–{{ p.end }}<span v-if="p.n_occurrences > 1" class="pp-muted" title="Occurs more than once in the sequence"> ×{{ p.n_occurrences }}</span></template>
              <span v-else class="pp-muted" title="Not in the canonical sequence">—</span>
            </td>
            <td>
              <router-link :to="{ path: '/apps/peptide-search', query: { mode: 'peptide', sequence: p.sequence } }" class="pp-seq">{{ p.sequence }}</router-link>
            </td>
            <td class="pp-forms">
              <span v-for="f in p.peptidoforms" :key="f.peptidoform" class="pp-form" :title="`${f.peptidoform}: ${f.n_obs.toLocaleString()} observations`"><Peptidoform :value="f.peptidoform" /></span>
              <span v-if="p.n_peptidoforms > p.peptidoforms.length" class="pp-muted"> +{{ p.n_peptidoforms - p.peptidoforms.length }}</span>
            </td>
            <td>{{ p.proteotypic ? 'yes' : 'shared' }}</td>
            <td class="td-num">{{ formatNum(p.n_datasets) }}</td>
            <td class="td-num">{{ formatNum(p.n_obs) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="shown.length > visibleCount" class="show-more-bar">
        <span class="show-more-info">Showing {{ visibleCount }} of {{ shown.length }} peptides</span>
        <button type="button" class="page-btn" @click="visibleCount += PAGE_SIZE">
          Show {{ Math.min(PAGE_SIZE, shown.length - visibleCount) }} more
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { apiGet } from '../api.js'
import { PEPTIDE_SEARCH_BASE } from '../config.js'
import { formatNum } from '../utils/format.js'
import Peptidoform from './Peptidoform.vue'

const props = defineProps({
  accession: { type: String, required: true },
  gppMin: { type: Number, default: null },
})
// loaded(n peptides) once rows arrive; unavailable when the protein has none or the request fails.
const emit = defineEmits(['loaded', 'unavailable'])

const PAGE_SIZE = 50
const data = ref([])
const loading = ref(true)
const proteotypicOnly = ref(false)
const sort = ref({ key: 'start', dir: 'asc' })
const visibleCount = ref(PAGE_SIZE)

const nProteotypic = computed(() => data.value.filter((p) => p.proteotypic).length)
const shown = computed(() => {
  const rows = proteotypicOnly.value ? data.value.filter((p) => p.proteotypic) : data.value.slice()
  const { key, dir } = sort.value
  const sign = dir === 'asc' ? 1 : -1
  // peptides outside the canonical sequence sort last by position
  const val = (p) => (key === 'start' ? (p.start ?? Infinity) : p[key])
  return rows.sort((a, b) => sign * (val(a) - val(b)) || b.n_obs - a.n_obs)
})
const visible = computed(() => shown.value.slice(0, visibleCount.value))

function sortBy(key) {
  sort.value = sort.value.key === key
    ? { key, dir: sort.value.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: key === 'start' ? 'asc' : 'desc' }
}
const arrow = (key) => (sort.value.key === key ? (sort.value.dir === 'asc' ? ' ▲' : ' ▼') : '')
const ariaSort = (key) => (sort.value.key === key ? (sort.value.dir === 'asc' ? 'ascending' : 'descending') : 'none')

let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  visibleCount.value = PAGE_SIZE
  const params = { accession: props.accession }
  if (props.gppMin != null) params.gpp_min = props.gppMin
  try {
    const res = await apiGet(PEPTIDE_SEARCH_BASE, '/protein/peptides', params)
    if (mine !== seq) return
    data.value = res.found ? res.peptides || [] : []
    if (data.value.length) emit('loaded', data.value.length)
    else emit('unavailable')
  } catch {
    if (mine !== seq) return
    data.value = []
    emit('unavailable')
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch(() => [props.accession, props.gppMin], load, { immediate: true })
</script>

<style scoped>
.pp-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin: 8px 0 12px;
}
.pp-filter {
  font-size: 13px;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pp-sort {
  all: unset;
  cursor: pointer;
}
.pp-sort:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.pp-pos {
  white-space: nowrap;
}
.pp-seq {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--brand);
  text-decoration: none;
}
.pp-seq:hover {
  text-decoration: underline;
}
.pp-forms {
  font-size: 12px;
}
.pp-form {
  display: inline-block;
  margin: 1px 8px 1px 0;
}
.pp-muted {
  color: var(--text-muted);
}
.pp-empty {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
}
</style>
