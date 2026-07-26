<template>
  <div class="de-qc-panel">
    <!-- Two-axis classification: how much to trust this dataset (data quality)
         and how much it can detect (statistical power). Deliberately shown
         above the pass/warn/fail gate badge, which answers a different
         question — whether the dataset should be published at all. -->
    <section v-if="hasClassification" class="de-qc-class">
      <QualityBadges :data-quality="dataQuality" :power="power" />

      <p v-if="powerDetail" class="de-qc-class-detail">{{ powerDetail }}</p>

      <ul v-if="classReasons.length" class="de-qc-reasons">
        <li v-for="(r, i) in classReasons" :key="i">{{ r }}</li>
      </ul>

      <p class="de-qc-class-note">
        Data quality and statistical power are graded independently: a dataset can be
        pristine and still underpowered, so few proteins reach significance.
      </p>
    </section>

    <!-- Quality block (present only for datasets rebuilt with the QC gate). -->
    <section v-if="hasQuality" class="de-qc-quality">
      <div class="de-qc-quality-head">
        <span class="de-qc-badge" :class="`de-qc-badge--${badgeStatus}`">{{ badgeLabel }}</span>
        <span v-if="recommendedLabel" class="de-qc-reco">Recommended: {{ recommendedLabel }}</span>
      </div>

      <ul v-if="reasons.length" class="de-qc-reasons">
        <li v-for="(r, i) in reasons" :key="i">{{ r }}</li>
      </ul>

      <div v-if="chips.length" class="de-qc-chips">
        <div v-for="c in chips" :key="c.label" class="de-qc-chip">
          <span class="de-qc-chip-label">{{ c.label }}</span>
          <span class="de-qc-chip-value">{{ c.value }}</span>
        </div>
      </div>

      <div v-if="scoreboard.length" class="de-qc-scoreboard-wrap">
        <table class="de-qc-scoreboard">
          <thead>
            <tr>
              <th>Normalization</th>
              <th>Method</th>
              <th class="de-qc-num">Score</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in scoreboard"
              :key="`${row.normalization}-${row.method}-${i}`"
              :class="{ 'de-qc-row--reco': isRecommended(row) }"
            >
              <td>{{ row.normalization }}</td>
              <td>{{ row.method }}</td>
              <td class="de-qc-num">{{ fmtScore(row.score) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Existing sample-level QC: PC1/PC2 scatter + normalization caption. -->
    <p v-if="!scatterData.datasets.length" class="de-qc-empty">No QC data available.</p>
    <template v-else>
      <ScatterChart :data="scatterData" :options="chartOptions" />
      <p v-if="normLabel" class="de-qc-norm">Normalization: {{ normLabel }}</p>
    </template>
  </div>
</template>

<script setup>
// Sample-level QC: a PC1/PC2 scatter (one dataset per group, from the shared
// ScatterChart wrapper) plus a one-line summary of the normalization applied.
// When the dataset was rebuilt with the DE QC gate, the `qc` prop also carries
// a quality block (quality status, per-contrast metrics, recommended pipeline
// and a scoreboard) which is rendered above the scatter; older datasets lack
// it and the block renders nothing.
import { computed } from 'vue'
import ScatterChart from './ScatterChart.vue'
import QualityBadges from './QualityBadges.vue'
import { classificationReasons } from '../utils/quality.js'

const props = defineProps({
  qc: { type: Object, default: () => ({ pca: [], norm: {} }) },
  // Contrast id/key for which to show the metrics summary. Falls back to the
  // first per_contrast entry when it doesn't match a key (or is empty).
  contrast: { type: String, default: '' },
})

const scatterData = computed(() => pcaToScatter(props.qc?.pca))
const normLabel = computed(() => props.qc?.norm?.method || '')

const hasQuality = computed(() => !!props.qc?.quality || !!props.qc?.scoreboard?.length)

const badgeStatus = computed(() => {
  const s = String(props.qc?.quality?.status || '').toLowerCase()
  return s === 'pass' || s === 'warn' || s === 'fail' ? s : 'unknown'
})
const badgeLabel = computed(() => (badgeStatus.value === 'unknown' ? 'N/A' : badgeStatus.value.toUpperCase()))
const reasons = computed(() =>
  badgeStatus.value === 'pass' ? [] : (props.qc?.quality?.reasons || []),
)

const recommendedLabel = computed(() => {
  const r = props.qc?.recommended_pipeline
  if (!r || (!r.normalization && !r.method)) return ''
  return [r.normalization, r.method].filter(Boolean).join(' · ')
})

const scoreboard = computed(() =>
  Array.isArray(props.qc?.scoreboard) ? props.qc.scoreboard : [],
)

// The per_contrast entry to summarize: prefer the one matching `contrast`,
// otherwise the first entry.
const currentContrastEntry = computed(() => {
  const pc = props.qc?.per_contrast
  if (!pc || typeof pc !== 'object') return null
  return (props.contrast && pc[props.contrast]) || pc[Object.keys(pc)[0]] || null
})
const currentContrastMetrics = computed(() => currentContrastEntry.value?.metrics || null)
const chips = computed(() => qcChips(currentContrastMetrics.value))

// Two-axis classification for the contrast on screen, falling back to the
// dataset-level block. Absent for datasets built before it existed, in which
// case the whole section is skipped rather than showing "unknown" badges next
// to metrics that would contradict them.
const classification = computed(
  () => currentContrastEntry.value?.classification || props.qc?.classification || null,
)
const hasClassification = computed(
  () => !!(classification.value?.data_quality || classification.value?.statistical_power),
)
const dataQuality = computed(() => classification.value?.data_quality || null)
const power = computed(() => classification.value?.statistical_power || null)

// Why the badges say what they say: the replicate depth behind the power level
// plus every reason the backend attached to either axis.
const powerDetail = computed(() => powerReplicateSummary(power.value))
const classReasons = computed(() => [
  ...classificationReasons(dataQuality.value),
  ...classificationReasons(power.value),
])

function isRecommended(row) {
  const r = props.qc?.recommended_pipeline
  return !!r && row.normalization === r.normalization && row.method === r.method
}

const chartOptions = {
  scales: {
    x: { title: { display: true, text: 'PC1' } },
    y: { title: { display: true, text: 'PC2' } },
  },
}
</script>

<script>
// Pure helper — builds a Chart.js scatter `data` object from PCA rows, with
// one dataset per distinct `group` so groups can be colored/toggled
// independently via the chart legend.
const PALETTE = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#0ea5e9', '#a855f7']

export function pcaToScatter(pca) {
  const groups = new Map()
  for (const p of pca || []) {
    const g = p.group ?? ''
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push({ x: p.pc1, y: p.pc2, sample: p.sample })
  }
  const datasets = [...groups.entries()].map(([label, data], i) => ({
    label,
    data,
    backgroundColor: PALETTE[i % PALETTE.length],
    borderColor: PALETTE[i % PALETTE.length],
  }))
  return { datasets }
}

// Format a score/number to 2 decimals; returns '' for non-finite input.
export function fmtScore(n) {
  return Number.isFinite(n) ? n.toFixed(2) : ''
}

// Pure helper — one-line replicate summary behind a statistical_power block,
// e.g. "3 replicates in the smallest group — DMSO: 3, Pomalidomide: 3". This
// is the number that explains a short significant-protein list, so it is shown
// next to the badge rather than hidden in a tooltip. Returns '' when the block
// carries no usable replicate counts.
export function powerReplicateSummary(power) {
  if (!power || typeof power !== 'object') return ''
  // `min_replicates` is null when the backend could not determine group sizes;
  // Number(null) is 0, so only a real number counts.
  const n = typeof power.min_replicates === 'number' ? power.min_replicates : Number.NaN
  const perGroup = power.per_group && typeof power.per_group === 'object' ? power.per_group : {}
  const parts = Object.entries(perGroup)
    .filter(([, v]) => Number.isFinite(Number(v)))
    .map(([k, v]) => `${k}: ${Number(v)}`)
  if (!Number.isFinite(n)) {
    return parts.length ? `Replicates per group — ${parts.join(', ')}` : ''
  }
  const head = `${n} replicate${n === 1 ? '' : 's'} in the smallest group`
  return parts.length ? `${head} — ${parts.join(', ')}` : head
}

// Pure helper — maps a per-contrast metrics object into an ordered list of
// labelled stat chips ({ label, value }). Chips whose underlying metric is
// missing/non-finite are omitted, so it degrades gracefully on partial data.
export function qcChips(metrics) {
  if (!metrics || typeof metrics !== 'object') return []
  const chips = []
  const num = (v) => (typeof v === 'number' ? v : Number(v))
  const isFin = (v) => Number.isFinite(num(v))

  const rc = metrics.replicate_correlation
  if (rc && isFin(rc.min)) {
    chips.push({ label: 'Replicate r (min)', value: num(rc.min).toFixed(3) })
  }
  if (isFin(metrics.missingness)) {
    chips.push({ label: 'Missingness', value: `${(num(metrics.missingness) * 100).toFixed(1)}%` })
  }
  if (isFin(metrics.pca_silhouette)) {
    chips.push({ label: 'PCA silhouette', value: num(metrics.pca_silhouette).toFixed(2) })
  }
  if (isFin(metrics.pi0)) {
    chips.push({ label: 'π₀', value: num(metrics.pi0).toFixed(2) })
  }
  if (isFin(metrics.n_significant)) {
    chips.push({ label: 'Significant', value: String(Math.round(num(metrics.n_significant))) })
  }
  return chips
}
</script>

<style scoped>
.de-qc-empty { color: var(--text-muted, #6b7280); padding: 8px 0; }
.de-qc-norm { margin: 8px 0 0; font-size: 13px; color: var(--text-muted, #6b7280); }

.de-qc-class { margin: 0 0 16px; display: flex; flex-direction: column; gap: 8px; }
.de-qc-class-detail {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  font-variant-numeric: tabular-nums;
}
.de-qc-class-note { margin: 0; font-size: 12px; color: var(--text-muted, #6b7280); max-width: 64ch; }

.de-qc-quality { margin: 0 0 16px; display: flex; flex-direction: column; gap: 12px; }
.de-qc-quality-head { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }

.de-qc-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 3px 12px;
  border-radius: 999px;
  line-height: 1.4;
}
.de-qc-badge--pass { background: rgba(16, 185, 129, 0.12); color: #059669; }
.de-qc-badge--warn { background: rgba(251, 191, 36, 0.14); color: #b45309; }
.de-qc-badge--fail { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
.de-qc-badge--unknown { background: rgba(100, 116, 139, 0.12); color: var(--text-secondary, #64748b); }

.de-qc-reco { font-size: 13px; color: var(--text-secondary, #64748b); }

.de-qc-reasons { margin: 0; padding-left: 18px; color: var(--text-secondary, #64748b); font-size: 13px; }
.de-qc-reasons li { margin: 2px 0; }

.de-qc-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.de-qc-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px;
  background: var(--bg-alt, #f8fafc);
  min-width: 96px;
}
.de-qc-chip-label { font-size: 11px; color: var(--text-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.03em; }
.de-qc-chip-value { font-size: 15px; font-weight: 600; color: var(--text-primary, #0f172a); font-variant-numeric: tabular-nums; }

.de-qc-scoreboard-wrap { overflow-x: auto; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; }
.de-qc-scoreboard { width: 100%; border-collapse: collapse; font-size: 13px; }
.de-qc-scoreboard th,
.de-qc-scoreboard td { padding: 7px 12px; text-align: left; white-space: nowrap; }
.de-qc-scoreboard thead th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted, #6b7280);
  border-bottom: 1px solid var(--border, #e2e8f0);
}
.de-qc-scoreboard tbody tr + tr td { border-top: 1px solid var(--border-subtle, #f1f5f9); }
.de-qc-num { text-align: right; font-variant-numeric: tabular-nums; }
.de-qc-row--reco { background: rgba(99, 102, 241, 0.08); }
.de-qc-row--reco td { font-weight: 600; color: var(--text-primary, #0f172a); }
</style>
