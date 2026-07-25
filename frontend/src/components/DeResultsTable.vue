<template>
  <div class="de-results-table">
    <div class="de-filter">
      <input
        v-model="query"
        type="search"
        placeholder="Filter by protein or gene…"
        aria-label="Filter results"
      />
    </div>
    <div class="de-table-wrap">
      <table class="de-table">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="sortable"
              role="button"
              tabindex="0"
              :aria-sort="ariaSort(col.key)"
              @click="onSort(col.key)"
              @keydown.enter.prevent="onSort(col.key)"
              @keydown.space.prevent="onSort(col.key)"
            >
              {{ col.label }}<span class="sort-ind">{{ ind(col.key) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="sortedRows.length === 0">
            <td :colspan="columns.length" class="empty-cell">No proteins match.</td>
          </tr>
          <tr
            v-for="row in sortedRows"
            :key="row.protein"
            class="row-clickable"
            :class="{ selected: row.protein === selected }"
            role="button"
            tabindex="0"
            :aria-selected="row.protein === selected"
            @click="emit('select', row.protein)"
            @keydown.enter.prevent="emit('select', row.protein)"
            @keydown.space.prevent="emit('select', row.protein)"
          >
            <td>
              <a
                :href="uniprotUrl(row.protein)"
                target="_blank"
                rel="noopener noreferrer"
                class="protein-link"
                @click.stop
              >{{ row.protein }}</a>
            </td>
            <td>{{ row.gene ?? '—' }}</td>
            <td class="td-num">{{ fmt(row.log2fc) }}</td>
            <td class="td-num">{{ fmt(row.pvalue) }}</td>
            <td class="td-num">{{ fmt(row.adj_pvalue) }}</td>
            <td class="td-num">{{ row.n_peptides ?? '—' }}</td>
            <td class="td-num">{{ fmt(row.mean_group_a) }}</td>
            <td class="td-num">{{ fmt(row.mean_group_b) }}</td>
            <td class="td-center">
              <span v-if="row.significant" class="sig-badge">yes</span>
              <span v-else class="muted">no</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
// Sortable, filterable results table for a differential-expression contrast.
// Shares protein selection with VolcanoPlot via the `selected` prop / `select`
// emit — clicking a row here or a point there drives the same highlighted
// protein.
import { ref, computed } from 'vue'
import { uniprotUrl } from '../utils/links.js'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  selected: { type: String, default: null },
})
const emit = defineEmits(['select'])

const columns = [
  { key: 'protein', label: 'Protein' },
  { key: 'gene', label: 'Gene' },
  { key: 'log2fc', label: 'log2FC' },
  { key: 'pvalue', label: 'p-value' },
  { key: 'adj_pvalue', label: 'Adj. p-value' },
  { key: 'n_peptides', label: 'Peptides' },
  { key: 'mean_group_a', label: 'Mean A' },
  { key: 'mean_group_b', label: 'Mean B' },
  { key: 'significant', label: 'Significant' },
]

const query = ref('')
const sortKey = ref('')
const sortDir = ref('asc')

const filteredRows = computed(() => filterRows(props.rows, query.value))
const sortedRows = computed(() =>
  sortKey.value ? sortRows(filteredRows.value, sortKey.value, sortDir.value) : filteredRows.value,
)

function onSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function ind(key) {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

function ariaSort(key) {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

function fmt(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return typeof v === 'number' ? v.toPrecision(4).replace(/\.?0+$/, '') || '0' : v
}
</script>

<script>
// Pure helpers — kept free of Vue reactivity so they're trivial to unit test
// and reusable if this table's sort/filter logic is ever needed elsewhere.

// Sorts a copy of `rows` by `rows[key]`, ascending or descending; rows whose
// value is null/undefined always sort to the end regardless of `dir`.
export function sortRows(rows, key, dir) {
  const mult = dir === 'desc' ? -1 : 1
  return [...(rows || [])].sort((a, b) => {
    const av = a ? a[key] : undefined
    const bv = b ? b[key] : undefined
    const aNull = av === null || av === undefined
    const bNull = bv === null || bv === undefined
    if (aNull && bNull) return 0
    if (aNull) return 1
    if (bNull) return -1
    if (av < bv) return -1 * mult
    if (av > bv) return 1 * mult
    return 0
  })
}

// Case-insensitive substring filter on `protein` and `gene`.
export function filterRows(rows, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return [...(rows || [])]
  return (rows || []).filter(
    (r) => (r.protein || '').toLowerCase().includes(q) || (r.gene || '').toLowerCase().includes(q),
  )
}
</script>

<style scoped>
.de-results-table {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.de-filter input {
  width: 100%;
  max-width: 320px;
  padding: 6px 10px;
  border: 1px solid var(--border, #eef0f3);
  border-radius: 6px;
  font-size: 14px;
}
.de-table-wrap {
  overflow-x: auto;
}
.de-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.de-table th,
.de-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #eef0f3);
  text-align: left;
}
.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.sortable:hover {
  color: var(--indigo, #6366f1);
}
.sort-ind {
  color: var(--indigo, #6366f1);
}
.td-num {
  text-align: right;
  font-family: var(--mono, monospace);
  font-variant-numeric: tabular-nums;
}
.td-center {
  text-align: center;
}
.row-clickable {
  cursor: pointer;
}
.row-clickable:hover {
  background: rgba(99, 102, 241, 0.04);
}
.selected {
  background: rgba(99, 102, 241, 0.1) !important;
}
.protein-link {
  color: var(--indigo, #6366f1);
  text-decoration: none;
}
.protein-link:hover {
  text-decoration: underline;
}
.sig-badge {
  color: #ef4444;
  font-weight: 600;
}
.muted {
  color: var(--text-secondary, #6b7280);
}
.empty-cell {
  text-align: center;
  padding: 24px;
  color: var(--text-muted, #9ca3af);
}
</style>
