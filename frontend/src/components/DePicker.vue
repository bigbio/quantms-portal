<template>
  <div>
    <p v-if="loading" class="de-loading">Loading datasets…</p>
    <div v-else class="de-picker-wrap">
      <label v-if="anyClassified" class="de-filter">
        <input v-model="highOnly" type="checkbox" />
        <span>High data quality only</span>
      </label>

      <table class="de-table">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Accession</th>
            <th scope="col">Organism</th>
            <th scope="col" class="num">Samples</th>
            <th scope="col">Factors</th>
            <th scope="col">Quality / power</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="d in visibleDatasets"
            :key="d.ref"
            class="de-row"
            role="button"
            tabindex="0"
            :aria-label="`Select dataset ${d.accession}`"
            @click="select(d)"
            @keyup.enter="select(d)"
          >
            <td>{{ d.title || d.accession }}</td>
            <td>{{ d.accession }}</td>
            <td>{{ d.organism || '—' }}</td>
            <td class="num">{{ d.n_samples ?? '—' }}</td>
            <td>{{ (d.factors || []).join(', ') || '—' }}</td>
            <td>
              <QualityBadges
                :data-quality="d.data_quality"
                :power="d.statistical_power"
                compact
              />
            </td>
          </tr>
          <tr v-if="!visibleDatasets.length">
            <td colspan="6" class="de-muted">{{ emptyMessage }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
// Dataset picker. Each row carries the two-axis classification badges
// (data quality x statistical power) in compact form so a whole catalogue can
// be scanned at a glance before committing to a dataset. Datasets built before
// the classification existed have null levels and render as "Unknown" rather
// than being hidden or crashing the table.
import { computed, ref } from 'vue'
import QualityBadges from './QualityBadges.vue'
import { qualityLevel } from '../utils/quality.js'

const props = defineProps({
  datasets: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const highOnly = ref(false)

// Only offer the filter once at least one dataset is actually classified —
// otherwise it could only ever empty the table.
const anyClassified = computed(() =>
  props.datasets.some((d) => qualityLevel(d?.data_quality) !== 'unknown'),
)

const visibleDatasets = computed(() =>
  highOnly.value
    ? props.datasets.filter((d) => qualityLevel(d?.data_quality) === 'high')
    : props.datasets,
)

const emptyMessage = computed(() =>
  highOnly.value && props.datasets.length
    ? 'No datasets match the high data quality filter.'
    : 'No datasets available.',
)

function select(d) {
  emit('select', d.ref)
}
</script>

<style scoped>
.de-loading { color: var(--muted, #6b7280); padding: 8px 0; }
.de-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
}
.de-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.de-table th, .de-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border, #eef0f3); }
.de-table th { color: var(--muted, #6b7280); font-weight: 600; }
.de-muted { color: #9ca3af; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.de-row { cursor: pointer; }
.de-row:hover { background: #f8fafc; }
.de-row:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; }

@media (max-width: 768px) {
  .de-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .de-table th, .de-table td { white-space: nowrap; }
}
</style>
