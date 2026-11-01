<template>
  <div class="qo">
    <QxProgress
      v-if="done < PARTS.length"
      :value="done / PARTS.length"
      :label="`Computing statistics · ${done} of ${PARTS.length}`"
      class="qo-progress"
    />

    <!-- Headline numbers -->
    <div v-if="tiles.length" class="qo-tiles">
      <div v-for="t in tiles" :key="t.label" class="qo-tile">
        <div class="qo-tile-val">{{ t.value }}</div>
        <div class="qo-tile-label">{{ t.label }}</div>
      </div>
    </div>

    <!-- Identification charts -->
    <p class="qo-lead">{{ lead }}</p>
    <div class="qo-grid" :style="gridCols(visibleCharts.length)">
      <section v-for="c in visibleCharts" :key="c.part" class="qo-panel">
        <h3 class="qo-h">{{ c.title }}</h3>
        <p class="qo-note">{{ noteOf(c) }}</p>
        <div v-if="parts[c.part].error" class="qo-empty">{{ parts[c.part].error }}</div>
        <div v-else-if="!parts[c.part].loaded" class="qo-skeleton" :style="{ height: `${c.height}px` }"></div>
        <StatsChart v-else-if="splitParts(c)" :type="c.hist != null || c.part === 'length' ? 'line' : 'bar'"
                    :data="splitData(c)" :options="splitOptions(c)" :height="c.height" />
        <StatsChart v-else type="bar" :data="barData(c)" :options="barOptions(c)" :height="c.height" />
      </section>
    </div>

    <!-- Sample annotations: each grouping field with its own colours, the ones the
         charts use when the page is coloured by that field -->
    <template v-if="metaFields.length || namingFields.length">
      <h3 class="qo-h qo-h-section">Samples</h3>
      <div v-if="metaFields.length" class="qo-grid" :style="gridCols(metaFields.length)">
        <section v-for="f in metaFields" :key="f.key" class="qo-panel" :class="{ 'qo-active': colouring && colouring.key === f.key }">
          <div class="qo-panel-head">
            <h3 class="qo-h">{{ f.title }}</h3>
            <span v-if="colouring && colouring.key === f.key" class="qo-using">colours the charts</span>
            <button v-else type="button" class="qo-use" @click="$emit('colour-by', f.key)">Colour by this</button>
          </div>
          <p class="qo-note">{{ f.distinct.toLocaleString() }} distinct in {{ f.annotated.toLocaleString() }} annotated samples</p>
          <div v-if="!f.scale" class="qo-skeleton" style="height: 140px"></div>
          <StatsChart v-else type="bar" :data="metaData(f)" :options="metaOptions" :height="Math.max(140, f.scale.values.length * 26)" />
        </section>
      </div>
      <p v-for="f in namingFields" :key="f.key" class="qo-note qo-naming">
        <strong>{{ f.title }}</strong>: {{ f.distinct.toLocaleString() }} distinct values in {{ f.annotated.toLocaleString() }}
        annotated samples, too many to group by; they are listed on the Samples tab.
      </p>
    </template>
  </div>
</template>

<script setup>
// Overview statistics for one qpx dataset. Each part is its own request, so the
// progress bar counts real completed work rather than guessing. When every run
// holds samples of one group, the distributions are then split by the group the
// page is coloured by (one SQL query per batch of parts over the same bins), so a
// technical difference that follows the biology shows up.
import { computed, reactive, watch } from 'vue'
import StatsChart from './StatsChart.vue'
import QxProgress from './QxProgress.vue'
import { qpxRunSql, qpxStats } from '../qpx.js'
import { chartColor } from '../utils/chartColors.js'
import { annotationFields } from '../sampleColors.js'

const props = defineProps({
  datasetRef: { type: String, required: true },
  // rows of the sample and run tables, for the annotation charts and the split
  samples: { type: Array, default: () => [] },
  runs: { type: Array, default: () => [] },
  // colour scale per annotation field (null while its groups are looked up)
  scales: { type: Object, default: () => ({}) },
  // the page's sample colouring (see QpxExplore), or null
  colouring: { type: Object, default: null },
})
defineEmits(['colour-by'])

const PARTS = ['summary', 'per_run', 'charge', 'length', 'missed_cleavages', 'mass_error', 'rt',
  'intensity', 'pep', 'peptides_per_protein']
const blank = () => ({ loaded: false, error: '', data: null })
const parts = reactive(Object.fromEntries(PARTS.map((p) => [p, blank()])))
const done = computed(() => PARTS.filter((p) => parts[p].loaded || parts[p].error).length)

function load(ref) {
  for (const p of PARTS) {
    Object.assign(parts[p], blank())
    qpxStats(ref, p)
      .then((d) => { if (ref === props.datasetRef) Object.assign(parts[p], { loaded: true, data: d }) })
      .catch((e) => { if (ref === props.datasetRef) parts[p].error = e.message || 'could not compute' })
  }
}
watch(() => props.datasetRef, (r) => { if (r) load(r) }, { immediate: true })

const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 }))
const source = computed(() => parts.summary.data?.source)
const sourceLabel = computed(() => (source.value === 'psm' ? 'PSMs' : 'features'))

const tiles = computed(() => {
  const s = parts.summary.data
  if (!s || !s.available) return []
  const out = [
    { label: 'Peptides', value: fmt(s.n_peptides) },
    { label: 'Peptidoforms', value: fmt(s.n_peptidoforms) },
    { label: `Median ${sourceLabel.value} per run`, value: fmt(s.median_per_run) },
  ]
  if (s.decoy_pct) out.push({ label: `Decoy ${sourceLabel.value}`, value: `${s.decoy_pct}%` })
  return out.filter((t) => t.value !== '—')
})

const H = 220
const idCharts = computed(() => {
  const src = sourceLabel.value
  return [
    { part: 'per_run', title: 'Identifications per run', note: `Target ${src} in each run.`, height: H, runs: true },
    { part: 'charge', title: 'Precursor charge', note: `Target ${src} by charge state.`, height: H, label: (k) => `${k}+` },
    { part: 'length', title: 'Peptide length', note: `Target ${src} by sequence length (residues).`, height: H },
    { part: 'missed_cleavages', title: 'Missed cleavages', note: `Target ${src} by missed cleavages.`, height: H },
    { part: 'peptides_per_protein', title: 'Peptides per protein group', note: 'Protein groups by number of peptides; 20 means 20 or more. Protein groups span runs, so this covers the whole dataset.', height: H, label: (k) => (k >= 20 ? '20+' : String(k)) },
    { part: 'mass_error', title: 'Precursor mass error', note: `Target ${src} by mass error (ppm); a tight peak near 0 means good calibration.`, height: H, hist: 1 },
    { part: 'rt', title: 'Retention time', note: `Target ${src} by retention time (minutes): how the gradient was used.`, height: H, hist: 0 },
    { part: 'intensity', title: 'Feature intensity', note: 'Target features by intensity (log10, summed over channels): dynamic range.', height: H, hist: 1 },
    { part: 'pep', title: 'Posterior error probability', note: `Target ${src} by PEP (log10); further left is more confident.`, height: H, hist: 1 },
  ]
})

function rowsOf(part) {
  const d = parts[part].data
  if (!d || !d.available) return []
  if (d.bins) return d.bins.map(([lo, hi, n]) => [(lo + hi) / 2, n])
  return d.rows || []
}

// Hide a panel once its part is known to have no data, so the grid has no holes.
const visibleCharts = computed(() => idCharts.value.filter((c) => {
  const p = parts[c.part]
  return p.error || !p.loaded || rowsOf(c.part).length > 0
}))

// Columns that leave the fewest empty slots in the last row (ties prefer 3).
function gridCols(n) {
  const best = [3, 2, 4].reduce((a, c) => ((n % c ? c - (n % c) : 0) < (n % a ? a - (n % a) : 0) ? c : a), 3)
  return { '--qo-cols': Math.max(1, Math.min(n, best)) }
}

// A distribution of the whole dataset takes the pooled navy, not a sample group's
// colour; bars that stand for samples or groups of samples pass their own colours.
function bars(labels, values, colours = chartColor('pooled')) {
  return {
    labels,
    datasets: [{ data: values, backgroundColor: colours, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24 }],
  }
}

// --- runs ------------------------------------------------------------------------

// Runs as bars in the colour of their sample's annotation, grouped by it and faded
// outside the highlighted group; runs of several samples with different values
// take the pooled navy.
const runInfo = (name) => (props.colouring ? props.colouring.run(name) : null)
const runsMixed = computed(() => {
  const rows = rowsOf('per_run')
  return !!props.colouring && rows.length > 0 && rows.every(([name]) => runInfo(name).mixed)
})
function runColour(name) {
  const c = props.colouring
  if (!c || runsMixed.value) return chartColor('pooled')
  const a = runInfo(name)
  const colour = a.mixed ? chartColor('pooled') : c.scale.colourOf(a.value)
  const faded = c.highlight && (a.mixed || !c.scale.matches(a.value, c.highlight))
  return faded ? `${colour}26` : colour
}
// Most first within each group, the groups in legend order.
const perRunRows = computed(() => {
  const rows = rowsOf('per_run')
  const c = props.colouring
  if (!c || runsMixed.value) return rows
  const rank = ([name]) => {
    const a = runInfo(name)
    return a.mixed ? Infinity : c.scale.rankOf(a.value)
  }
  return rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => rank(a) - rank(b) || i - j).map(([r]) => r)
})

// --- distributions split by sample group -------------------------------------------

// The value each target row adds to a distribution, as the backend computes it
// (RT in minutes, intensity and PEP as log10), per source table.
const SPLIT_VALUES = {
  feature: {
    charge: 'charge', length: 'length(sequence)', missed_cleavages: 'missed_cleavages', mass_error: 'mass_error_ppm', rt: 'rt / 60',
    intensity: 'log10(nullif(list_sum(list_transform(intensities, x -> x.intensity)), 0))',
    pep: 'log10(nullif(posterior_error_probability, 0))',
  },
  psm: {
    charge: 'charge', length: 'length(sequence)', mass_error: '(observed_mz - calculated_mz) / calculated_mz * 1e6', rt: 'rt / 60',
    pep: 'log10(nullif(posterior_error_probability, 0))',
  },
}
// Two queries, so each answer stays under the SQL endpoint's 2,000-row cap.
const SPLIT_BATCHES = [['charge', 'length', 'missed_cleavages', 'mass_error'], ['rt', 'intensity', 'pep']]

// The backend's bins of a histogram part: origin, width and count.
function binsOf(part) {
  const b = parts[part].data?.bins
  if (!b || !b.length) return null
  const lo = b[0][0]
  const w = parts[part].data.bin_width
  return { lo, w, n: Math.round((b[b.length - 1][1] - lo) / w) }
}

// The groups to split by: the colouring's, with the runs drawn in each.
const splitPlan = computed(() => {
  const c = props.colouring
  if (!c || runsMixed.value || !SPLIT_VALUES[source.value]) return null
  const groups = c.scale.splits
  const index = new Map(groups.map((g, i) => [g.label, i]))
  const runs = []
  for (const r of props.runs) {
    const a = c.run(r.run_file_name)
    if (!a.mixed && a.value != null && index.has(c.scale.splitOf(a.value))) runs.push([r.run_file_name, index.get(c.scale.splitOf(a.value))])
  }
  if (new Set(runs.map(([, i]) => i)).size < 2) return null
  return { key: `${props.datasetRef}|${c.key}|${groups.map((g) => g.label).join('|')}`, groups, runs }
})

const split = reactive({ key: '', loading: false, failed: false, parts: {} })
const sqlNum = (x) => String(Number(x))

function splitSql(batch, runs) {
  const values = SPLIT_VALUES[source.value]
  const ps = batch.filter((p) => values[p] && rowsOf(p).length)
  if (!ps.length) return null
  const key = (p) => {
    const b = binsOf(p)
    if (!b) return `v_${p}`
    const hi = b.lo + b.n * b.w
    return `CASE WHEN v_${p} BETWEEN ${sqlNum(b.lo)} AND ${sqlNum(hi)} THEN least(floor((v_${p} - ${sqlNum(b.lo)}) / ${sqlNum(b.w)})::INTEGER, ${b.n - 1}) END`
  }
  const list = runs.map(([run, i]) => `('${run.replaceAll("'", "''")}', ${i})`).join(', ')
  return {
    ps,
    sql: `WITH g(run, s) AS (VALUES ${list}),
r AS (SELECT g.s, ${ps.map((p) => `${values[p]} AS v_${p}`).join(', ')} FROM ${source.value} t JOIN g ON t.run_file_name = g.run WHERE NOT t.is_decoy),
k AS (SELECT s, ${ps.map((p) => `${key(p)} AS k_${p}`).join(', ')} FROM r)
SELECT s, ${ps.map((p) => `k_${p}, GROUPING(k_${p}) AS g_${p}`).join(', ')}, count(*) AS n
FROM k GROUP BY GROUPING SETS (${ps.map((p) => `(s, k_${p})`).join(', ')})`,
  }
}

async function runSplit(plan) {
  Object.assign(split, { key: plan.key, loading: true, failed: false, parts: {} })
  const ref = props.datasetRef
  const out = {}
  const queries = SPLIT_BATCHES.map((b) => splitSql(b, plan.runs)).filter(Boolean)
  try {
    await Promise.all(queries.map(async ({ ps, sql }) => {
      const res = await qpxRunSql(ref, { sql, limit: 2000 })
      if (res.truncated) throw new Error('split truncated')
      for (const p of ps) out[p] = plan.groups.map(() => new Map())
      for (const row of res.rows) {
        const n = row[row.length - 1]
        ps.forEach((p, i) => {
          const k = row[1 + 2 * i]
          if (row[2 + 2 * i] === 0 && k != null) out[p][row[0]].set(k, n)
        })
      }
    }))
    if (split.key === plan.key) Object.assign(split, { loading: false, parts: out })
  } catch {
    if (split.key === plan.key) Object.assign(split, { loading: false, failed: true })
  }
}

// Split once the backend's bins are known; a new dataset or colouring splits again.
const binsReady = computed(() => SPLIT_BATCHES.flat().every((p) => parts[p].loaded || parts[p].error))
watch([splitPlan, binsReady], ([plan, ready]) => {
  if (!plan) Object.assign(split, { key: '', loading: false, failed: false, parts: {} })
  else if (ready && plan.key !== split.key) runSplit(plan)
}, { immediate: true })

const splitParts = (c) => (split.key && splitPlan.value && split.key === splitPlan.value.key ? split.parts[c.part] : null)
const highlighted = (g) => {
  const h = props.colouring?.highlight
  return !h || h === g.label || h === g.family
}

function splitData(c) {
  // the bins and values the whole-dataset chart shows (the backend leaves out empty bins)
  const b = binsOf(c.part)
  const keys = b
    ? parts[c.part].data.bins.map(([lo]) => Math.round((lo - b.lo) / b.w))
    : rowsOf(c.part).map(([k]) => k)
  const label = b ? (k) => (b.lo + (k + 0.5) * b.w).toFixed(binDecimals(c.part)) : (c.label || String)
  const line = c.hist != null || c.part === 'length'
  const datasets = splitPlan.value.groups.map((g, i) => {
    const m = split.parts[c.part][i]
    const total = [...m.values()].reduce((a, n) => a + n, 0)
    if (!total) return null
    const colour = highlighted(g) ? g.colour : `${g.colour}33`
    const data = keys.map((k) => (100 * (m.get(k) || 0)) / total)
    return line
      ? { label: g.label, data, borderColor: colour, backgroundColor: colour, borderWidth: props.colouring.highlight && highlighted(g) ? 3 : 2, pointRadius: 0, tension: 0 }
      : { label: g.label, data, backgroundColor: colour, borderRadius: 2, maxBarThickness: 14 }
  }).filter(Boolean)
  return { labels: keys.map(label), datasets }
}

function splitOptions() {
  return {
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` } },
    },
    interaction: { mode: 'index', intersect: false },
    scales: { y: { beginAtZero: true, ticks: { callback: (v) => `${v}%` } } },
  }
}

// --- notes and pooled charts -----------------------------------------------------------

const lead = computed(() => {
  const c = props.colouring
  if (!c) return 'The distributions cover the whole dataset. Per-sample and per-run quality is on the QC tab.'
  const t = c.title.toLowerCase()
  if (runsMixed.value) return `Each run holds samples with different ${t}, so runs and distributions cover the whole dataset (navy). Per-sample quality, coloured by ${t}, is on the QC tab.`
  if (split.failed) return `The distributions could not be split by ${t}; they cover the whole dataset (navy).`
  if (split.loading || !binsReady.value) return `Runs are coloured and grouped by ${t}; splitting the distributions by ${t}…`
  if (!splitPlan.value) return `Runs are coloured and grouped by ${t}; the distributions cover the whole dataset (navy).`
  return `Runs and distributions by ${t}: each line or bar is one group's share of its target ${sourceLabel.value}, so groups of different size compare; runs without an annotation are left out. Per-sample quality is on the QC tab.`
})

function noteOf(c) {
  if (c.runs) {
    const col = props.colouring
    if (!col) return `${c.note} Most first.`
    return runsMixed.value
      ? `${c.note} Most first; each run holds several samples with different ${col.title.toLowerCase()}, so runs keep one colour.`
      : `${c.note} Grouped by ${col.title.toLowerCase()}, most first within each.`
  }
  return `${c.note}${outsideNote(c.part)}`
}

// Enough decimals that neighbouring bins get different labels.
function binDecimals(part) {
  const w = parts[part].data?.bin_width
  return w > 0 ? Math.min(6, Math.max(0, Math.ceil(-Math.log10(w)))) : 1
}

function outsideNote(part) {
  const d = parts[part].data
  if (!d || !d.n_outside) return ''
  const total = d.n_outside + (d.bins || []).reduce((a, b) => a + b[2], 0)
  return ` ${d.n_outside.toLocaleString()} (${((100 * d.n_outside) / total).toFixed(1)}%) outside the range are not drawn.`
}

function barData(c) {
  const rows = c.runs ? perRunRows.value : rowsOf(c.part)
  const label = c.label || (c.hist != null ? (k) => Number(k).toFixed(binDecimals(c.part)) : String)
  return bars(rows.map(([k]) => label(k)), rows.map(([, n]) => n), c.runs ? rows.map(([k]) => runColour(k)) : undefined)
}

function barOptions(c) {
  const opts = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  if (c.hist != null) {
    // a histogram: bars touch
    opts.datasets = { bar: { categoryPercentage: 1, barPercentage: 1, borderRadius: 1 } }
  }
  if (c.runs) {
    // hundreds of runs: no tick labels, the tooltip names the run
    opts.scales.x = { ticks: { display: false }, grid: { display: false } }
    opts.datasets = { bar: { categoryPercentage: 1, barPercentage: 0.9, borderRadius: 1 } }
    if (props.colouring) {
      const { title } = props.colouring
      opts.plugins.tooltip = { callbacks: { afterLabel: (ctx) => {
        const a = runInfo(ctx.label)
        return `${title}: ${a.mixed ? 'several' : (a.value ?? 'not annotated')}`
      } } }
    }
  }
  return opts
}

// Fields that group samples get a chart of their groups; fields with mostly
// unique values (one cell line per sample) only a line of text.
const fields = computed(() => annotationFields(props.samples))
const metaFields = computed(() => fields.value.filter((f) => f.groups).map((f) => ({ ...f, scale: props.scales[f.key] || null })))
const namingFields = computed(() => fields.value.filter((f) => !f.groups))
const metaData = (f) => bars(f.scale.values.map((l) => l.label), f.scale.values.map((l) => l.n), f.scale.values.map((l) => l.colour))
const metaOptions = { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
</script>

<style scoped>
.qo { margin-top: 8px; }
.qo-progress { margin-bottom: 16px; max-width: 420px; }
.qo-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
.qo-tile { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 12px 16px; }
.qo-tile-val { font-size: 20px; font-weight: 700; font-family: var(--mono); color: var(--text-primary); }
.qo-tile-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.qo-grid { display: grid; grid-template-columns: repeat(var(--qo-cols, 3), minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; align-items: start; }
@media (max-width: 1000px) { .qo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.qo-panel { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 14px 16px; min-width: 0; }
.qo-h { font-size: 14px; font-weight: 600; margin: 0; color: var(--text-primary); }
.qo-h-section { font-size: 16px; margin: 8px 0 12px; }
.qo-lead { font-size: 12px; color: var(--text-muted); margin: 0 0 10px; max-width: 860px; }
.qo-panel-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.qo-active { border-color: var(--text-muted); }
.qo-using { font-size: 12px; color: var(--text-muted); }
.qo-use { all: unset; cursor: pointer; font-size: 12px; color: var(--indigo); }
.qo-use:hover, .qo-use:focus-visible { text-decoration: underline; }
.qo-naming { margin-bottom: 6px; }
.qo-note { font-size: 12px; color: var(--text-muted); margin: 2px 0 10px; }
.qo-empty { color: var(--text-muted); font-size: 13px; padding: 24px 0; text-align: center; }
.qo-skeleton { border-radius: 6px; background: linear-gradient(90deg, var(--border) 25%, var(--bg-alt) 50%, var(--border) 75%);
  background-size: 200% 100%; animation: qo-shimmer 1.4s infinite; opacity: 0.5; }
@keyframes qo-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .qo-skeleton { animation: none; } }
@media (max-width: 600px) { .qo-grid { grid-template-columns: 1fr; } }
</style>
