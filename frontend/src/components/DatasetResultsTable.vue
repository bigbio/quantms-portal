<template>
  <div class="dataset-table-wrap">
    <table class="dataset-table">
      <thead>
        <tr>
          <th style="width: 28px"></th>
          <th :class="{ sortable: true }" @click="onSort('accession')">
            Accession<span class="sort-ind">{{ ind('accession') }}</span>
          </th>
          <th>Collection</th>
          <th>Organism</th>
          <th>Instrument</th>
          <th class="num sortable" @click="onSort('peptides')">
            Peptides<span class="sort-ind">{{ ind('peptides') }}</span>
          </th>
          <th class="num sortable" @click="onSort('proteins')">
            Proteins<span class="sort-ind">{{ ind('proteins') }}</span>
          </th>
          <th class="num sortable" @click="onSort('samples')">
            Samples<span class="sort-ind">{{ ind('samples') }}</span>
          </th>
          <th class="num sortable" @click="onSort('size')">
            Size<span class="sort-ind">{{ ind('size') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="datasets.length === 0">
          <td colspan="9" class="empty-cell">No datasets match.</td>
        </tr>
        <template v-for="(ds, idx) in datasets" :key="rowKey(ds, idx)">
          <tr class="row-clickable" :class="{ 'row-open': isOpen(ds, idx) }" @click="toggle(ds, idx)">
            <td class="caret-cell">
              <span class="caret" :class="{ open: isOpen(ds, idx) }">▸</span>
            </td>
            <td><span class="accession-link">{{ ds.accession }}</span></td>
            <td><span class="tag" :class="collectionTag(ds.collection)">{{ ds.collection_title || ds.collection }}</span></td>
            <td class="cell-sm">{{ ds.organism || '—' }}</td>
            <td class="cell-sm muted">{{ cleanInstrument(ds.instrument) || '—' }}</td>
            <td class="td-num">{{ formatNum(ds.peptides) }}</td>
            <td class="td-num">{{ formatNum(ds.proteins) }}</td>
            <td class="td-num">{{ formatNum(ds.samples) }}</td>
            <td class="td-num">{{ ds.total_size ? formatBytes(ds.total_size) : '—' }}</td>
          </tr>
          <tr v-if="isOpen(ds, idx)" class="panel-row">
            <td colspan="9" style="padding: 0">
              <DatasetPanel :dataset="ds" variant="inline" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DatasetPanel from './DatasetPanel.vue'
import { formatNum, formatBytes, cleanInstrument, collectionTag } from '../utils/format.js'

const props = defineProps({
  datasets: { type: Array, default: () => [] },
  // current backend sort key (peptides|proteins|samples|size|accession)
  sort: { type: String, default: '' },
})
const emit = defineEmits(['sort'])

const openKey = ref(null)

function rowKey(ds, idx) {
  return (ds.dataset_ref || ds.accession || 'row') + '-' + idx
}
function isOpen(ds, idx) {
  return openKey.value === rowKey(ds, idx)
}
function toggle(ds, idx) {
  const k = rowKey(ds, idx)
  openKey.value = openKey.value === k ? null : k
}
function onSort(key) {
  emit('sort', key)
}
function ind(key) {
  return props.sort === key ? ' ↓' : ''
}
</script>

<style scoped>
.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.sortable:hover {
  color: var(--indigo);
}
.sort-ind {
  color: var(--indigo);
}
.num {
  text-align: right;
}
.td-num {
  text-align: right;
  font-family: var(--mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.cell-sm {
  font-size: 13px;
}
.muted {
  color: var(--text-secondary);
}
.row-clickable {
  cursor: pointer;
}
.row-open {
  background: rgba(99, 102, 241, 0.04) !important;
}
.caret-cell {
  text-align: center;
}
.caret {
  display: inline-block;
  color: var(--text-muted);
  transition: transform 0.15s;
  font-size: 12px;
}
.caret.open {
  transform: rotate(90deg);
  color: var(--indigo);
}
.panel-row td {
  border-bottom: 1px solid var(--border) !important;
}
.empty-cell {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
}
.dataset-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
}
</style>
