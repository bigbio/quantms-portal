<template>
  <div>
    <p v-if="loading" class="de-loading">Loading datasets…</p>
    <div v-else class="de-picker-wrap">
      <div class="de-picker-tools">
        <input
          v-model="query"
          type="search"
          class="de-search"
          placeholder="Filter by title, accession, organism or contrast…"
          aria-label="Filter datasets"
        />
        <label v-if="anyClassified" class="de-filter">
          <input v-model="highOnly" type="checkbox" />
          <span>High data quality only</span>
        </label>
      </div>

      <ul class="de-cards">
        <li
          v-for="d in visibleDatasets"
          :key="d.ref"
          class="de-row de-card"
          role="button"
          tabindex="0"
          :aria-label="`Select dataset ${d.accession || d.ref}`"
          @click="select(d)"
          @keyup.enter="select(d)"
        >
          <div class="de-card-head">
            <div class="de-card-id">
              <h3 class="de-card-title">{{ title(d) }}</h3>
              <div class="de-card-sub">
                <span class="de-acc">{{ d.accession || d.ref }}</span>
                <span v-if="d.organism" class="de-sub-item">{{ d.organism }}</span>
                <span v-if="d.n_samples != null" class="de-sub-item">
                  {{ d.n_samples }} samples
                </span>
                <span v-if="factors(d)" class="de-sub-item">{{ factors(d) }}</span>
              </div>
            </div>
            <QualityBadges
              :data-quality="d.data_quality"
              :power="d.statistical_power"
              compact
            />
          </div>

          <p v-if="d.summary" class="de-card-summary">{{ d.summary }}</p>

          <div v-if="chipsOf(d).shown.length" class="de-contrasts">
            <span class="de-contrasts-label">Contrasts</span>
            <span
              v-for="c in chipsOf(d).shown"
              :key="c.id"
              class="tag de-contrast-chip"
              :title="c.factor ? `Factor: ${c.factor}` : null"
            >
              {{ c.label }}
            </span>
            <span v-if="chipsOf(d).extra" class="de-contrast-more">
              +{{ chipsOf(d).extra }} more
            </span>
          </div>

          <p v-if="summaryOf(d).length" class="de-card-results">
            <span v-for="(part, i) in summaryOf(d)" :key="part.key">
              <span v-if="i" class="de-dot"> · </span>
              <span :title="part.title">
                <strong>{{ part.value }}</strong> {{ part.label }}
              </span>
            </span>
          </p>

          <div v-if="contextOf(d).length" class="de-context">
            <span
              v-for="c in contextOf(d)"
              :key="c.key"
              class="tag de-context-chip"
              :title="c.title"
            >
              {{ c.value }}
            </span>
          </div>
        </li>
        <li v-if="!visibleDatasets.length" class="de-muted de-empty">{{ emptyMessage }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
// Dataset picker. One card per dataset, ordered so the decision-relevant
// information comes first: what the study is (title + summary), what it
// compares (contrast chips), what came out (quantified / significant / on-off)
// and under which conditions (context chips), with the two-axis classification
// badges (data quality x statistical power) pinned to the header.
//
// The backend enriches these entries progressively, so EVERY field beyond
// ref/accession is optional: a dataset built before the enrichment existed
// renders as a bare title + accession card rather than a wall of placeholders.
// The pure shaping helpers live in ../utils/dataset.js and are unit-tested
// there.
import { computed, ref } from 'vue'
import QualityBadges from './QualityBadges.vue'
import { qualityLevel } from '../utils/quality.js'
import {
  datasetTitle,
  resultsSummary,
  contextChips,
  contrastChips,
  datasetMatches,
} from '../utils/dataset.js'

const props = defineProps({
  datasets: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const highOnly = ref(false)
const query = ref('')

// Only offer the quality filter once at least one dataset is actually
// classified — otherwise it could only ever empty the list.
const anyClassified = computed(() =>
  props.datasets.some((d) => qualityLevel(d?.data_quality) !== 'unknown'),
)

const visibleDatasets = computed(() =>
  props.datasets
    .filter((d) => (highOnly.value ? qualityLevel(d?.data_quality) === 'high' : true))
    .filter((d) => datasetMatches(d, query.value)),
)

const emptyMessage = computed(() => {
  if (!props.datasets.length) return 'No datasets available.'
  if (query.value.trim()) return `No datasets match “${query.value.trim()}”.`
  if (highOnly.value) return 'No datasets match the high data quality filter.'
  return 'No datasets available.'
})

const title = (d) => datasetTitle(d)
const summaryOf = (d) => resultsSummary(d?.results)
const contextOf = (d) => contextChips(d?.context)
const chipsOf = (d) => contrastChips(d?.contrasts)
const factors = (d) => (Array.isArray(d?.factors) ? d.factors : []).join(', ')

function select(d) {
  emit('select', d.ref)
}
</script>

<style scoped>
.de-loading { color: var(--muted, #6b7280); padding: 8px 0; }
.de-picker-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 0 0 12px;
}
.de-search {
  flex: 1 1 260px;
  max-width: 380px;
  padding: 6px 10px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 6px;
  font: inherit;
  font-size: 14px;
  background: var(--surface, #fff);
  color: inherit;
}
.de-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
}

.de-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.de-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 10px;
  background: var(--surface, #fff);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.de-card:hover {
  border-color: var(--indigo-light, #818cf8);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
}
.de-card:focus-visible { outline: 2px solid var(--indigo, #6366f1); outline-offset: 2px; }

.de-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.de-card-id { min-width: 0; }
.de-card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.35;
  color: var(--text-primary, #0f172a);
  overflow-wrap: anywhere;
}
.de-card-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}
.de-acc { font-family: var(--mono, monospace); font-size: 12px; }
.de-sub-item::before { content: "· "; opacity: 0.6; }

.de-card-summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary, #64748b);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.de-contrasts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.de-contrasts-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted, #6b7280);
}
.de-contrast-chip {
  background: rgba(124, 58, 237, 0.1);
  color: var(--violet, #7c3aed);
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
}
.de-contrast-more { font-size: 12px; color: var(--text-secondary, #64748b); }

.de-card-results {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary, #64748b);
  font-variant-numeric: tabular-nums;
}
.de-card-results strong { color: var(--text-primary, #0f172a); font-weight: 650; }
.de-dot { opacity: 0.6; }

.de-context {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.de-context-chip {
  background: rgba(100, 116, 139, 0.1);
  color: var(--text-secondary, #64748b);
  font-size: 11px;
}

.de-muted { color: var(--text-muted, #9ca3af); }
.de-empty { padding: 12px 2px; font-size: 14px; }

@media (max-width: 560px) {
  .de-card-head { flex-direction: column; }
}
</style>
