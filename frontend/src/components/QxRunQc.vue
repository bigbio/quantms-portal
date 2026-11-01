<template>
  <section class="rq">
    <QxProgress v-if="loading" label="Computing per-run QC…" class="rq-progress" />
    <p v-else-if="error" class="notice">{{ error }}</p>
    <p v-else-if="data && !data.available" class="qx-hint">This dataset has no feature table to compute run QC from.</p>
    <template v-else-if="data">
      <div class="rq-head">
        <p class="rq-summary">
          <strong :class="{ 'rq-warn': data.n_flagged }">{{ data.n_flagged ? '⚠ ' : '' }}{{ data.n_flagged.toLocaleString() }}</strong>
          of {{ data.rows.length.toLocaleString() }} runs flagged.
          A value is flagged when it is far from {{ BASELINE_TEXT[data.baseline] || data.baseline }} (robust z &gt; {{ data.robust_z }}),
          the difference is large enough to matter, and it points the way that signals a problem: fewer identifications,
          more contaminants or missed cleavages, or intensity or mass error off either way.
        </p>
        <label class="rq-toggle"><input v-model="onlyFlagged" type="checkbox" :disabled="!data.n_flagged" /> Only flagged runs</label>
      </div>
      <QxRunChart
        v-if="data.rows.length > 1"
        :rows="data.rows"
        :columns="data.columns"
        :baseline="data.baseline"
        :colouring="colouring"
        :selected="selected"
        @select="select"
      />
      <div ref="tableEl">
        <QxTable :columns="columns" :rows="shown" sort-key="run" sort-dir="asc" empty-text="No runs." row-key="run" :selected="selected">
          <template #cell="{ column, row, text }">
            <span v-if="flagOf(row, column)" class="rq-flag" :title="flagTitle(flagOf(row, column))">⚠ {{ text }}</span>
            <span v-else-if="column === 'flags'" :class="{ 'rq-warn': row.flags.length }">{{ flagText(row) }}</span>
            <template v-else>{{ text }}</template>
          </template>
        </QxTable>
      </div>
    </template>
  </section>
</template>

<script setup>
// Per-run QC metrics with outlier flags (GET /qc/runs).
import { computed, nextTick, ref, watch } from 'vue'
import QxTable from './QxTable.vue'
import QxProgress from './QxProgress.vue'
import QxRunChart from './QxRunChart.vue'
import { qpxQc } from '../qpx.js'
import { colLabel } from '../qpxFormat.js'

const props = defineProps({
  datasetRef: { type: String, required: true },
  // passed on to the chart; see QxRunChart
  colouring: { type: Object, default: null },
})

const data = ref(null)
const loading = ref(false)
const error = ref('')
const onlyFlagged = ref(false)
const selected = ref('')
const tableEl = ref(null)

// A dot clicked in the chart: show its run's row.
async function select(run) {
  selected.value = run
  if (onlyFlagged.value && !data.value.rows.find((r) => r.run === run).flags.length) onlyFlagged.value = false
  await nextTick()
  tableEl.value.querySelector('.qt-selected')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

async function load(r) {
  loading.value = true
  error.value = ''
  data.value = null
  selected.value = ''
  try {
    const d = await qpxQc(r, 'runs')
    if (r === props.datasetRef) data.value = d
  } catch (e) {
    if (r === props.datasetRef) error.value = e.message || 'could not compute run QC'
  } finally {
    if (r === props.datasetRef) loading.value = false
  }
}
watch(() => props.datasetRef, (r) => { if (r) load(r) }, { immediate: true })

const BASELINE_TEXT = { 'same fraction': 'runs of the same fraction', 'all runs': 'the other runs' }

// Drop columns that say nothing here: one value for every run, or one plex per run (label-free).
const columns = computed(() => {
  const rows = data.value?.rows || []
  const distinct = (c) => new Set(rows.map((r) => r[c])).size
  const uninformative = (c) => (c === 'fraction' && distinct(c) <= 1) || (c === 'plex' && distinct(c) === rows.length)
  return [...(data.value?.columns || []).filter((c) => !uninformative(c)), 'flags']
})
const shown = computed(() => (data.value?.rows || [])
  .map((r) => ({ ...r, flags: r.flags || [] }))
  .filter((r) => !onlyFlagged.value || r.flags.length))

const flagOf = (row, column) => (row.flags || []).find((f) => f.metric === column)
const flagTitle = (f) => `${colLabel(f.metric)} is ${f.direction} (robust z ${f.z})`
const flagText = (row) => row.flags.map((f) => `${colLabel(f.metric)} ${f.direction}`).join(', ') || '—'
</script>

<style scoped>
.rq-progress { max-width: 420px; margin: 24px 0; }
.rq-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
.rq-summary { margin: 0; font-size: 13px; color: var(--text-secondary); max-width: 760px; }
.rq-toggle { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.rq-warn { color: var(--qual-medium); font-weight: 600; }
.rq-flag { color: var(--qual-medium); font-weight: 600; }
</style>
