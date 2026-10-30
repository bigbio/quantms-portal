<template>
  <div class="qt" :aria-busy="loading">
    <div v-if="error" class="notice">{{ error }}</div>
    <QxProgress v-if="loading && !rows.length" class="qt-state-progress" label="Loading…" />
    <div v-else-if="!rows.length && !error" class="qt-state">{{ emptyText }}</div>
    <div
      v-else-if="rows.length"
      class="dataset-table-wrap qt-wrap"
      :class="{ 'qt-updating': loading, 'qt-scrolled': scrolled }"
      @scroll.passive="scrolled = $event.target.scrollLeft > 0"
    >
      <QxProgress v-if="loading" class="qt-refresh" />
      <table class="dataset-table qt-table">
        <thead>
          <tr>
            <th
              v-for="(c, j) in cols"
              :key="c.key"
              :class="{ 'qt-num': numeric[j] }"
              :aria-sort="sortState.key === c.key ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none'"
            >
              <button v-if="c.sortable !== false" class="qt-sort" @click="toggleSort(c.key, numeric[j])">
                {{ c.label }}<span class="qt-arrow">{{ arrow(c.key) }}</span>
              </button>
              <span v-else>{{ c.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in shownRows"
            :key="rowKey ? cell(r, rowKey, -1) : i"
            :class="{ 'qt-selected': selected != null && rowKey && cell(r, rowKey, -1) === selected }"
          >
            <td v-for="(c, j) in cols" :key="c.key" :class="numeric[j] ? 'qt-num' : 'qt-text'" :title="fmt(r, c, j).title">
              <slot name="cell" :column="c.key" :value="cell(r, c.key, j)" :row="r" :text="fmt(r, c, j).text">
                {{ fmt(r, c, j).text }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
// Sortable table for qpx rows. Rows are arrays (aligned with `columns`) or objects.
// serverSort: header clicks emit `sort` and the parent reloads; otherwise rows sort here.
import { computed, reactive, ref, watch } from 'vue'
import { colLabel, compareValues, formatCell, isNumericColumn } from '../qpxFormat.js'
import QxProgress from './QxProgress.vue'

const props = defineProps({
  // ['col', ...] or [{ key, label, sortable }]
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  serverSort: { type: Boolean, default: false },
  sortKey: { type: String, default: '' },
  sortDir: { type: String, default: 'desc' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  emptyText: { type: String, default: 'No rows.' },
  rowKey: { type: String, default: '' },
  selected: { type: [String, Number], default: null },
})
const emit = defineEmits(['sort'])
// scrolled sideways: the pinned first column casts a shadow
const scrolled = ref(false)

const cols = computed(() => props.columns.map((c) => (typeof c === 'string'
  ? { key: c, label: colLabel(c) }
  : { label: colLabel(c.key), ...c })))

function cell(row, key, j) {
  if (Array.isArray(row)) {
    const idx = j >= 0 ? j : cols.value.findIndex((c) => c.key === key)
    return row[idx]
  }
  return row ? row[key] : undefined
}

function fmt(row, c, j) {
  return formatCell(cell(row, c.key, j), c.key)
}

const numeric = computed(() => cols.value.map((c, j) => isNumericColumn(props.rows.map((r) => cell(r, c.key, j)))))

const sortState = reactive({ key: props.sortKey, dir: props.sortDir })
watch(() => [props.sortKey, props.sortDir], ([k, d]) => { sortState.key = k; sortState.dir = d })

function toggleSort(key, isNum) {
  if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
  else { sortState.key = key; sortState.dir = isNum ? 'desc' : 'asc' }
  if (props.serverSort) emit('sort', { key: sortState.key, dir: sortState.dir })
}

function arrow(key) {
  if (sortState.key !== key) return ''
  return sortState.dir === 'asc' ? ' ▲' : ' ▼'
}

const shownRows = computed(() => {
  if (props.serverSort || !sortState.key) return props.rows
  const j = cols.value.findIndex((c) => c.key === sortState.key)
  if (j < 0) return props.rows
  const sign = sortState.dir === 'asc' ? 1 : -1
  return props.rows.slice().sort((a, b) => {
    const va = cell(a, sortState.key, j)
    const vb = cell(b, sortState.key, j)
    const empty = (v) => v == null || v === ''
    if (empty(va) || empty(vb)) return compareValues(va, vb) // empty last either way
    return sign * compareValues(va, vb)
  })
})
</script>

<style scoped>
.qt-wrap { position: relative; max-height: 70vh; overflow: auto; }
.qt-table thead th { position: sticky; top: 0; z-index: 2; background: var(--bg-alt); padding: 8px 12px; }
.qt-table td { padding: 7px 12px; }
/* the first column (the row's name) stays in view when the table scrolls sideways */
.qt-table th:first-child, .qt-table td:first-child { position: sticky; left: 0; }
.qt-table td:first-child { z-index: 1; background: var(--surface); }
.qt-table thead th:first-child { z-index: 3; }
.qt-table tbody tr:hover td:first-child { background: #fafcfe; }
.qt-table tbody tr.qt-selected td:first-child { background: #edf2f9; }
.qt-scrolled .qt-table th:first-child, .qt-scrolled .qt-table td:first-child { box-shadow: 6px 0 8px -6px rgba(15, 23, 42, 0.25); }
.qt-sort { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 2px;
  text-transform: inherit; letter-spacing: inherit; font: inherit; color: inherit; }
.qt-sort:hover { color: var(--text-primary); }
.qt-sort:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; border-radius: 2px; }
.qt-arrow { color: var(--indigo); font-size: 10px; }
.qt-num { text-align: right; font-family: var(--mono); font-size: 13px; white-space: nowrap; }
th.qt-num .qt-sort { justify-content: flex-end; }
.qt-text { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qt-selected { background: rgba(26, 95, 180, 0.08); }
.qt-state { text-align: center; padding: 40px 12px; color: var(--text-muted); }
.qt-updating table { opacity: 0.5; transition: opacity 0.15s; }
.qt-state-progress { max-width: 320px; margin: 40px auto; }
.qt-refresh { position: sticky; top: 0; left: 0; z-index: 2; }
</style>
