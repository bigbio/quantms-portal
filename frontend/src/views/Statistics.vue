<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="section-header" style="text-align: left; margin-bottom: 20px">
        <h2>Portal Statistics</h2>
        <p style="margin: 0">
          Aggregated across every quantms collection — datasets, peptides, proteins, peptidoforms,
          species, tissues, instruments, the modification landscape, and proteome coverage.
        </p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-block">Loading portal statistics…</div>

      <!-- Error / retry -->
      <div v-else-if="error" class="notice">
        Portal statistics are temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="load">Retry</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!stats" class="notice">No statistics have been published yet.</div>

      <template v-else>
        <!-- KPI cards -->
        <div class="kpi-grid">
          <div v-for="k in kpis" :key="k.label" class="kpi-card">
            <div class="kpi-value">{{ formatBig(k.value) }}</div>
            <div class="kpi-label">{{ k.label }}</div>
          </div>
        </div>

        <!-- PTM distribution (flagship) -->
        <section class="chart-card wide">
          <div class="chart-head">
            <h3>Modification landscape</h3>
            <div class="metric-toggle">
              <button v-for="m in modMetrics" :key="m.key" :class="{ active: modMetric === m.key }" @click="modMetric = m.key">{{ m.label }}</button>
            </div>
          </div>
          <p class="chart-sub">Distinct {{ modMetricLabel.toLowerCase() }} carrying each modification. Hover a bar for the per-residue split.</p>
          <div v-if="modChart.labels.length" class="chart-scroll">
            <StatsChart type="bar" :data="modChart" :options="modOptions" :height="Math.max(280, modChart.labels.length * 26)" />
          </div>
          <p v-else class="chart-empty">No modification data.</p>
        </section>

        <div class="chart-row">
          <!-- Species distribution -->
          <section class="chart-card">
            <div class="chart-head">
              <h3>Species distribution</h3>
              <div class="metric-toggle">
                <button v-for="m in speciesMetrics" :key="m.key" :class="{ active: speciesMetric === m.key }" @click="speciesMetric = m.key">{{ m.label }}</button>
              </div>
            </div>
            <p class="chart-sub">Distinct {{ speciesMetricLabel.toLowerCase() }} per organism (top {{ TOP }} + long tail).</p>
            <div v-if="speciesChart.labels.length" class="chart-scroll">
              <StatsChart type="bar" :data="speciesChart" :options="hbarOptions" :height="Math.max(260, speciesChart.labels.length * 24)" />
            </div>
            <p v-else class="chart-empty">No species data.</p>
          </section>

          <!-- Instrument distribution -->
          <section class="chart-card">
            <h3>Instruments</h3>
            <p class="chart-sub">Datasets per instrument (top 10).</p>
            <div v-if="instrumentChart.labels.length">
              <StatsChart type="doughnut" :data="instrumentChart" :height="320" />
            </div>
            <p v-else class="chart-empty">No instrument data.</p>
          </section>
        </div>

        <div class="chart-row">
          <!-- Tissue distribution -->
          <section class="chart-card">
            <h3>Tissues / organism parts</h3>
            <p class="chart-sub">Datasets per tissue (top {{ TOP }}).</p>
            <div v-if="tissueChart.labels.length" class="chart-scroll">
              <StatsChart type="bar" :data="tissueChart" :options="hbarOptions" :height="Math.max(220, tissueChart.labels.length * 24)" />
            </div>
            <p v-else class="chart-empty">No tissue data.</p>
          </section>

          <!-- Proteome coverage -->
          <section class="chart-card">
            <h3>Proteome coverage</h3>
            <p class="chart-sub">Observed distinct <strong>genes</strong> vs the reference proteome (identifiers are collapsed to genes, so the same protein under an accession and a mnemonic counts once; hover for counts).</p>
            <div v-if="coverageChart.labels.length" class="chart-scroll">
              <StatsChart type="bar" :data="coverageChart" :options="coverageOptions" :height="Math.max(220, coverageChart.labels.length * 30)" />
            </div>
            <p v-else class="chart-empty">No coverage data.</p>
          </section>
        </div>

        <!-- Per-collection breakdown -->
        <section class="chart-card wide">
          <h3>Per-collection breakdown</h3>
          <p class="chart-sub">Datasets, peptides, peptidoforms and proteins in each collection<span v-if="hasSamples"> and samples</span>.</p>
          <div class="table-wrap">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Collection</th>
                  <th class="num">Datasets</th>
                  <th class="num">Peptides</th>
                  <th class="num">Peptidoforms</th>
                  <th class="num">Proteins</th>
                  <th v-if="hasSamples" class="num">Samples</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in stats.collections" :key="c.name">
                  <td><span class="tag" :class="collectionTag(c.name)">{{ c.name }}</span></td>
                  <td class="td-num">{{ formatNum(c.datasets) }}</td>
                  <td class="td-num">{{ formatNum(c.peptides) }}</td>
                  <td class="td-num">{{ formatNum(c.peptidoforms) }}</td>
                  <td class="td-num">{{ formatNum(c.proteins) }}</td>
                  <td v-if="hasSamples" class="td-num">{{ formatNum(c.samples) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p class="generated">
          Generated {{ stats.generated_at }}<span v-if="stats.source && stats.source.index_rows"> · {{ formatNum(stats.source.index_rows) }} index rows</span>
          <span v-if="stats.warnings && stats.warnings.length" class="warn"> · {{ stats.warnings.length }} source warning(s)</span>
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiGet } from '../api.js'
import { BROWSE_BASE, STATS_PATH } from '../config.js'
import { formatBig, formatNum, cleanInstrument, collectionTag } from '../utils/format.js'
import StatsChart from '../components/StatsChart.vue'

const TOP = 25

const stats = ref(null)
// The 'samples' column is only shown when a real (non-zero) per-collection sample
// count exists; no current source exposes it, so the backend omits the field and
// the column is hidden rather than rendered empty.
const hasSamples = computed(() => (stats.value?.collections || []).some((c) => c.samples > 0))
const loading = ref(true)
const error = ref(false)

const speciesMetric = ref('datasets')
const modMetric = ref('peptidoforms')

const speciesMetrics = [
  { key: 'datasets', label: 'Datasets' },
  { key: 'proteins', label: 'Proteins' },
  { key: 'peptides', label: 'Peptides' },
]
const modMetrics = [
  { key: 'peptidoforms', label: 'Peptidoforms' },
  { key: 'peptides', label: 'Peptides' },
  { key: 'datasets', label: 'Datasets' },
]
const speciesMetricLabel = computed(() => speciesMetrics.find((m) => m.key === speciesMetric.value).label)
const modMetricLabel = computed(() => modMetrics.find((m) => m.key === modMetric.value).label)

// Palette from the portal design tokens (falls back to literals for SSR-less canvas).
const PALETTE = ['#6366f1', '#7c3aed', '#409eff', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#0ea5e9', '#f43f5e']
const color = (i) => PALETTE[i % PALETTE.length]
const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// --- KPI cards ---------------------------------------------------------------
const kpis = computed(() => {
  const k = stats.value?.kpis || {}
  return [
    { label: 'Datasets', value: k.datasets },
    { label: 'Peptides', value: k.peptides },
    { label: 'Peptidoforms', value: k.peptidoforms },
    { label: 'Proteins', value: k.proteins },
    { label: 'Modified peptidoforms', value: k.modified_peptidoforms },
    { label: 'Organisms', value: k.organisms },
    { label: 'Collections', value: k.collections },
    { label: 'Observations', value: k.observations },
  ]
})

// --- shared horizontal-bar options ------------------------------------------
const hbarOptions = { indexAxis: 'y' }

// --- PTM (flagship) ----------------------------------------------------------
const modChart = computed(() => {
  const mods = (stats.value?.modifications || []).slice().sort((a, b) => (b[modMetric.value] || 0) - (a[modMetric.value] || 0))
  return {
    labels: mods.map((m) => m.modification),
    datasets: [{
      label: modMetricLabel.value,
      data: mods.map((m) => m[modMetric.value] || 0),
      backgroundColor: mods.map((_, i) => alpha(color(i), 0.85)),
      borderColor: mods.map((_, i) => color(i)),
      borderWidth: 1,
      // stash per-residue split for the tooltip
      _sites: mods.map((m) => m.sites || []),
    }],
  }
})
const modOptions = {
  indexAxis: 'y',
  plugins: {
    tooltip: {
      callbacks: {
        afterLabel: (ctx) => {
          const sites = (ctx.dataset._sites || [])[ctx.dataIndex] || []
          if (!sites.length) return ''
          return sites.map((s) => `  ${s.residue}: ${Number(s.peptidoforms).toLocaleString()}`)
        },
      },
    },
  },
}

// --- species -----------------------------------------------------------------
const speciesChart = computed(() => {
  const rows = (stats.value?.species || []).slice()
  const tail = stats.value?.species_long_tail
  const labels = rows.map((r) => r.organism)
  const data = rows.map((r) => r[speciesMetric.value] || 0)
  if (tail && tail.organisms) {
    labels.push(`${tail.organisms} other organisms`)
    data.push(tail[speciesMetric.value] || 0)
  }
  return {
    labels,
    datasets: [{
      label: speciesMetricLabel.value,
      data,
      backgroundColor: labels.map((_, i) => alpha(color(i), 0.85)),
      borderColor: labels.map((_, i) => color(i)),
      borderWidth: 1,
    }],
  }
})

// --- instruments (doughnut, top 10 + Other) ---------------------------------
const instrumentChart = computed(() => {
  const all = (stats.value?.instruments || []).map((i) => ({ name: cleanInstrument(i.instrument), datasets: i.datasets }))
  const top = all.slice(0, 10)
  const rest = all.slice(10).reduce((s, i) => s + i.datasets, 0)
  const labels = top.map((i) => i.name)
  const data = top.map((i) => i.datasets)
  if (rest > 0) { labels.push('Other'); data.push(rest) }
  return {
    labels,
    datasets: [{ data, backgroundColor: labels.map((_, i) => color(i)), borderWidth: 0 }],
  }
})

// --- tissues -----------------------------------------------------------------
const tissueChart = computed(() => {
  const rows = (stats.value?.tissues || []).slice(0, TOP)
  return {
    labels: rows.map((t) => t.tissue),
    datasets: [{
      label: 'Datasets',
      data: rows.map((t) => t.datasets),
      backgroundColor: rows.map((_, i) => alpha(color(i), 0.85)),
      borderColor: rows.map((_, i) => color(i)),
      borderWidth: 1,
    }],
  }
})

// --- proteome coverage -------------------------------------------------------
const coverageChart = computed(() => {
  const rows = (stats.value?.proteome_coverage || []).slice()
  return {
    labels: rows.map((r) => r.organism),
    datasets: [{
      label: 'Coverage %',
      data: rows.map((r) => Math.min(100, Math.round((r.coverage || 0) * 1000) / 10)),
      backgroundColor: rows.map((_, i) => alpha(color(i), 0.85)),
      borderColor: rows.map((_, i) => color(i)),
      borderWidth: 1,
      _rows: rows,
    }],
  }
})
const coverageOptions = computed(() => ({
  indexAxis: 'y',
  scales: { x: { max: 100, ticks: { callback: (v) => v + '%' } } },
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const r = ctx.dataset._rows[ctx.dataIndex]
          const pct = Math.round((r.coverage || 0) * 1000) / 10
          return [
            `Coverage: ${pct}%`,
            `Observed: ${Number(r.observed_proteins).toLocaleString()}`,
            `Reference: ${Number(r.reference_proteins).toLocaleString()}`,
          ]
        },
        afterLabel: (ctx) => ctx.dataset._rows[ctx.dataIndex].reference_source,
      },
    },
  },
}))

// --- load --------------------------------------------------------------------
async function load() {
  loading.value = true
  error.value = false
  try {
    stats.value = await apiGet(BROWSE_BASE, STATS_PATH, null, { retries: 1 })
  } catch (e) {
    error.value = true
    stats.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  margin-bottom: 28px;
}
.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 16px;
  text-align: center;
}
.kpi-value {
  font-size: 30px;
  font-weight: 700;
  color: var(--indigo);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.kpi-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}
.chart-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}
.chart-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 20px;
}
.chart-card.wide {
  grid-column: 1 / -1;
}
.chart-card h3 {
  margin: 0;
  font-size: 16px;
}
.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.chart-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin: 4px 0 14px;
}
.chart-empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}
.chart-scroll {
  width: 100%;
  overflow-x: auto;
}
.metric-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 7px;
  overflow: hidden;
}
.metric-toggle button {
  padding: 5px 12px;
  background: var(--surface);
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  font-family: var(--font);
  font-size: 12px;
}
.metric-toggle button.active {
  background: var(--indigo);
  color: #fff;
}
.table-wrap {
  overflow-x: auto;
}
.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.stats-table th,
.stats-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;
}
.stats-table th.num,
.td-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.loading-block {
  text-align: center;
  padding: 64px 0;
  color: var(--text-muted);
}
.notice {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-secondary);
}
.generated {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}
.generated .warn {
  color: #f59e0b;
}
</style>
