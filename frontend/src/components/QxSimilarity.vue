<template>
  <section class="sm">
    <p class="qx-hint">{{ designNote(design) }}</p>

    <!-- Principal components -->
    <div class="sm-head">
      <h3 class="qx-section">Principal components</h3>
      <div v-if="map && !map.reason" class="sm-tools">
        <label v-if="map.explained.length > 2" class="sm-pick">
          Axes
          <select v-model="axes">
            <option v-for="o in AXES" :key="o.join()" :value="o.join()">PC{{ o[0] + 1 }} × PC{{ o[1] + 1 }}</option>
          </select>
        </label>
        <QxExport :name="`${fileStem}-pca`" :png="() => pcaWrap" :csv="pcaCsv" />
      </div>
    </div>
    <QxProgress v-if="matrix.loading" label="Reading every sample’s protein values…" class="sm-progress" />
    <p v-else-if="matrix.error" class="notice">{{ matrix.error }}</p>
    <p v-else-if="map && map.reason" class="qx-hint">{{ map.reason }}</p>
    <template v-else-if="map">
      <p class="sm-note">
        {{ map.samples.length.toLocaleString() }} samples, on the {{ map.proteins.toLocaleString() }} most variable of the
        {{ map.complete.toLocaleString() }} proteins quantified in every sample<template v-if="colouring">, coloured by {{ colouring.title.toLowerCase() }}</template>.
        Each axis gives its share of the variance.
      </p>
      <div ref="pcaWrap" class="sm-plot" @mouseleave="hover = null">
        <svg v-if="width" :width="width" :height="H" role="img" :aria-label="`Principal components of ${map.samples.length} samples`">
          <g class="sm-grid">
            <g v-for="t in xTicks" :key="`x${t}`">
              <line :x1="x(t)" :x2="x(t)" :y1="PAD_T" :y2="H - PAD_B" />
              <text :x="x(t)" :y="H - PAD_B + 14" text-anchor="middle">{{ tick(t) }}</text>
            </g>
            <g v-for="t in yTicks" :key="`y${t}`">
              <line :x1="PAD_L" :x2="width - PAD_R" :y1="y(t)" :y2="y(t)" />
              <text :x="PAD_L - 6" :y="y(t)" dy="0.32em" text-anchor="end">{{ tick(t) }}</text>
            </g>
          </g>
          <text class="sm-axis" :x="(PAD_L + width - PAD_R) / 2" :y="H - 6" text-anchor="middle">{{ axisTitle(pc[0]) }}</text>
          <text class="sm-axis" :transform="`translate(14 ${(PAD_T + H - PAD_B) / 2}) rotate(-90)`" text-anchor="middle">{{ axisTitle(pc[1]) }}</text>
          <circle
            v-for="p in points" :key="p.sample"
            :cx="p.x" :cy="p.y" r="4.5" class="sm-dot"
            :class="{ dim: dimmed(p.sample), hot: hover && hover.sample === p.sample }"
            :style="{ fill: colourOf(p.sample) }"
          />
          <circle v-for="p in points" :key="`h${p.sample}`" :cx="p.x" :cy="p.y" r="9" class="sm-hit" @mouseenter="hover = p" />
        </svg>
        <div v-if="hover" class="sm-tip" :style="tipStyle">
          <strong>{{ hover.sample }}</strong>
          <span v-if="colouring">{{ colouring.title }}: {{ colouring.value(hover.sample) ?? 'not annotated' }}</span>
          <span>PC{{ pc[0] + 1 }} {{ hover.scores[pc[0]].toFixed(2) }} · PC{{ pc[1] + 1 }} {{ hover.scores[pc[1]].toFixed(2) }}</span>
        </div>
      </div>
    </template>

    <!-- Sample correlation -->
    <template v-if="map && !map.reason">
      <div class="sm-head">
        <h3 class="qx-section">Sample correlation</h3>
        <QxExport :name="`${fileStem}-correlation`" :png="() => corrCanvas" :csv="corrCsv" />
      </div>
      <p class="sm-note">
        Pearson r between samples over the same proteins, samples in legend order<template v-if="colouring"> (the strips give each sample’s {{ colouring.title.toLowerCase() }})</template>.
        <template v-if="corr && corr.lo < 0">Red above 0, blue below, on one scale either side of 0.</template>
        <template v-else>Colour runs from the lowest r in the dataset (light) to the highest (dark).</template>
      </p>
      <div ref="corrWrap" class="sm-corr" @mouseleave="cell = null">
        <canvas ref="corrCanvas" @mousemove="onCorrMove" />
        <div v-if="cell" class="sm-tip" :style="cell.style">
          <strong>r = {{ cell.r.toFixed(3) }}</strong>
          <span>{{ cell.a }}</span>
          <span>{{ cell.b }}</span>
        </div>
      </div>
    </template>

    <!-- Completeness -->
    <div class="sm-head">
      <h3 class="qx-section">Completeness</h3>
      <QxExport v-if="completeness.data" :name="`${fileStem}-completeness`" :png="() => complWrap" :csv="complCsv" />
    </div>
    <QxProgress v-if="completeness.loading" label="Counting where each protein is quantified…" class="sm-progress" />
    <p v-else-if="completeness.error" class="notice">{{ completeness.error }}</p>
    <template v-else-if="completeness.data">
      <p class="sm-note">{{ complSummary }}</p>
      <div ref="complWrap">
        <StatsChart type="bar" :data="complChart" :options="complOptions" :height="220" />
      </div>
    </template>
  </section>
</template>

<script setup>
// The Explorer's sample map: principal components and sample-to-sample
// correlation of the proteins quantified in every sample, and how completely the
// proteins are quantified. Samples take the page's annotation colours.
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import QxExport from './QxExport.vue'
import QxProgress from './QxProgress.vue'
import StatsChart from './StatsChart.vue'
import { qpxAnalysisSql } from '../qpx.js'
import { completenessSql, correlationMatrix, designNote, matrixSql, pca } from '../qpxAnalysis.js'
import { orderByGroup } from '../sampleColors.js'
import { chartColor, DIVERGING_MID, mix, ramp } from '../utils/chartColors.js'
import { niceTicks } from '../utils/format.js'
import { REGULATION_META } from '../utils/regulation.js'

const props = defineProps({
  datasetRef: { type: String, required: true },
  design: { type: Object, required: true },
  // { key, title, scale, value(sample), highlight } or null
  colouring: { type: Object, default: null },
})

const H = 380
const PAD_L = 56
const PAD_R = 14
const PAD_T = 12
const PAD_B = 42
const AXES = [[0, 1], [0, 2], [1, 2]]

const fileStem = computed(() => props.datasetRef.replace('/', '_'))
// shallow: the analyses read the large matrix without reactive proxies
const matrix = shallowRef({ loading: false, error: '', rows: null, complete: 0 })
const completeness = shallowRef({ loading: false, error: '', data: null })

async function load(r) {
  matrix.value = { loading: true, error: '', rows: null, complete: 0 }
  completeness.value = { loading: true, error: '', data: null }
  const sameRef = () => r === props.datasetRef
  qpxAnalysisSql(r, matrixSql(props.design)).then((d) => {
    if (sameRef()) matrix.value = { loading: false, error: '', rows: d.rows, complete: d.rows.length ? d.rows[0][2] : 0 }
  }).catch((e) => {
    if (sameRef()) matrix.value = { loading: false, error: e.message || 'could not read the samples’ values', rows: null, complete: 0 }
  })
  qpxAnalysisSql(r, completenessSql(props.design)).then((d) => {
    if (sameRef()) completeness.value = { loading: false, error: '', data: d.rows }
  }).catch((e) => {
    if (sameRef()) completeness.value = { loading: false, error: e.message || 'could not count protein completeness', data: null }
  })
}
watch(() => props.datasetRef, (r) => { if (r) load(r) }, { immediate: true })

// --- principal components ---
const map = computed(() => {
  const rows = matrix.value.rows
  if (!rows) return null
  if (rows.length < 3) return { reason: 'A sample map needs at least three samples with protein values.' }
  if (rows[0][1].length < 3) {
    return { reason: `Only ${matrix.value.complete} proteins are quantified in every sample, too few for a sample map.` }
  }
  const values = rows.map((r) => r[1])
  const { scores, explained } = pca(values)
  return {
    samples: rows.map((r) => r[0]),
    values,
    scores,
    explained,
    proteins: values[0].length,
    complete: matrix.value.complete,
  }
})

const axes = ref('0,1')
const pc = computed(() => axes.value.split(',').map(Number))
const axisTitle = (i) => `PC${i + 1} (${(map.value.explained[i] * 100).toFixed(1)} % of variance)`

const pcaWrap = ref(null)
const width = ref(0)
let observer = null
watch(pcaWrap, (el) => {
  if (observer) observer.disconnect()
  if (!el) return
  width.value = el.clientWidth
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(([e]) => { width.value = Math.round(e.contentRect.width) })
    observer.observe(el)
  }
})
onBeforeUnmount(() => observer && observer.disconnect())

const extent = (vs) => {
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const pad = (hi - lo) * 0.06 || 1
  return [lo - pad, hi + pad]
}
const xDomain = computed(() => extent(map.value.scores.map((s) => s[pc.value[0]])))
const yDomain = computed(() => extent(map.value.scores.map((s) => s[pc.value[1]])))
const x = (v) => PAD_L + ((v - xDomain.value[0]) / (xDomain.value[1] - xDomain.value[0])) * (width.value - PAD_L - PAD_R)
const y = (v) => PAD_T + (1 - (v - yDomain.value[0]) / (yDomain.value[1] - yDomain.value[0])) * (H - PAD_T - PAD_B)
const xTicks = computed(() => niceTicks(...xDomain.value))
const yTicks = computed(() => niceTicks(...yDomain.value))
const tick = (t) => (Math.abs(t) >= 100 ? t.toFixed(0) : String(t))

const colourOf = (s) => (props.colouring ? props.colouring.scale.colourOf(props.colouring.value(s)) : chartColor('pooled'))
const dimmed = (s) => {
  const h = props.colouring?.highlight
  return !!h && !props.colouring.scale.matches(props.colouring.value(s), h)
}
const points = computed(() => (map.value && !map.value.reason && width.value
  ? map.value.samples.map((sample, i) => {
    const scores = map.value.scores[i]
    return { sample, scores, x: x(scores[pc.value[0]]), y: y(scores[pc.value[1]]) }
  })
  : []))

const hover = ref(null)
const tipStyle = computed(() => {
  const p = hover.value
  const side = p.x > width.value * 0.65 ? { right: `${width.value - p.x + 12}px` } : { left: `${p.x + 12}px` }
  return { ...side, top: `${Math.max(4, p.y - 20)}px` }
})

function pcaCsv() {
  const k = map.value.explained.length
  const pcs = Array.from({ length: k }, (_, i) => `PC${i + 1}`)
  const columns = ['sample', ...(props.colouring ? [props.colouring.key] : []), ...pcs]
  const rows = map.value.samples.map((s, i) => [s, ...(props.colouring ? [props.colouring.value(s)] : []),
    ...map.value.scores[i].map((v) => Number(v.toFixed(5)))])
  return { columns, rows }
}

// --- sample correlation ---
const corr = computed(() => {
  if (!map.value || map.value.reason) return null
  const order = orderByGroup(map.value.samples, props.colouring)
  const at = new Map(map.value.samples.map((s, i) => [s, i]))
  const r = correlationMatrix(order.map((s) => map.value.values[at.get(s)]))
  let lo = 1
  let hi = -1
  r.forEach((row, i) => row.forEach((v, j) => { if (i !== j) { lo = Math.min(lo, v); hi = Math.max(hi, v) } }))
  return { order, r, lo, hi: hi > lo ? hi : lo + 1e-6 }
})

const corrWrap = ref(null)
const corrCanvas = ref(null)
const STRIP = 8
const GAP = 3
const LEGEND = 34
let corrGeom = null

function drawCorrelation() {
  const c = corr.value
  const canvas = corrCanvas.value
  if (!c || !canvas || !corrWrap.value) return
  const n = c.order.length
  const avail = Math.min(corrWrap.value.clientWidth - 2, 620)
  const cellSize = Math.max(1, Math.floor((avail - STRIP - GAP) / n * 100) / 100)
  const side = cellSize * n
  const off = STRIP + GAP
  const cssW = Math.ceil(off + side)
  const cssH = Math.ceil(off + side + LEGEND)
  const dpr = window.devicePixelRatio || 1
  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)
  // r of both signs: diverging around 0 (as on the heatmap); else one hue over the range seen
  const diverging = c.lo < 0
  const span = Math.max(-c.lo, c.hi)
  const [light, dark] = ramp(2)
  const up = Array.from({ length: 51 }, (_, i) => mix(DIVERGING_MID, REGULATION_META.up.color, i / 50))
  const down = Array.from({ length: 51 }, (_, i) => mix(DIVERGING_MID, REGULATION_META.down.color, i / 50))
  const lut = Array.from({ length: 101 }, (_, i) => mix(light, dark, i / 100))
  const colourAt = diverging
    ? (v) => (v >= 0 ? up : down)[Math.round(Math.min(1, Math.abs(v) / span) * 50)]
    : (v) => lut[Math.round(Math.min(1, Math.max(0, (v - c.lo) / (c.hi - c.lo))) * 100)]
  const lo = diverging ? -span : c.lo
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colourOf(c.order[i])
    ctx.fillRect(off + i * cellSize, 0, Math.max(cellSize, 1), STRIP)
    ctx.fillRect(0, off + i * cellSize, STRIP, Math.max(cellSize, 1))
  }
  // one pixel per cell, scaled up unsmoothed: far faster than a rectangle per cell
  const cells = new ImageData(n, n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const hex = colourAt(c.r[i][j])
      const k = (i * n + j) * 4
      cells.data[k] = parseInt(hex.slice(1, 3), 16)
      cells.data[k + 1] = parseInt(hex.slice(3, 5), 16)
      cells.data[k + 2] = parseInt(hex.slice(5, 7), 16)
      cells.data[k + 3] = 255
    }
  }
  const bitmap = document.createElement('canvas')
  bitmap.width = n
  bitmap.height = n
  bitmap.getContext('2d').putImageData(cells, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(bitmap, off, off, side, side)
  // legend: the colour ramp and its range
  const ly = off + side + 12
  const lw = Math.min(200, side)
  const grad = ctx.createLinearGradient(off, 0, off + lw, 0)
  for (let i = 0; i <= 10; i++) grad.addColorStop(i / 10, colourAt(lo + ((c.hi - lo) * i) / 10))
  ctx.fillStyle = grad
  ctx.fillRect(off, ly, lw, 8)
  const text = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#59636e'
  ctx.fillStyle = text
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(`r ${lo.toFixed(2)}`, off, ly + 11)
  if (diverging) {
    ctx.textAlign = 'center'
    ctx.fillText('0', off + (lw * -lo) / (c.hi - lo), ly + 11)
  }
  ctx.textAlign = 'right'
  ctx.fillText(c.hi.toFixed(2), off + lw, ly + 11)
  corrGeom = { off, cellSize, n }
}

const cell = ref(null)
function onCorrMove(ev) {
  if (!corrGeom) return
  const { off, cellSize, n } = corrGeom
  const i = Math.floor((ev.offsetY - off) / cellSize)
  const j = Math.floor((ev.offsetX - off) / cellSize)
  if (i < 0 || j < 0 || i >= n || j >= n) { cell.value = null; return }
  const c = corr.value
  const w = corrWrap.value.clientWidth
  const side = ev.offsetX > w * 0.6 ? { right: `${w - ev.offsetX + 14}px` } : { left: `${ev.offsetX + 14}px` }
  cell.value = { r: c.r[i][j], a: c.order[i], b: c.order[j], style: { ...side, top: `${Math.max(4, ev.offsetY - 24)}px` } }
}

watch([corr, corrCanvas], () => nextTick(drawCorrelation))
watch(width, () => nextTick(drawCorrelation))

function corrCsv() {
  const c = corr.value
  return { columns: ['sample', ...c.order], rows: c.order.map((s, i) => [s, ...c.r[i].map((v) => Number(v.toFixed(5)))]) }
}

// --- completeness ---
const complWrap = ref(null)
const BIN_LABELS = ['1–10 %', '11–20 %', '21–30 %', '31–40 %', '41–50 %', '51–60 %', '61–70 %', '71–80 %', '81–90 %', '91–99 %', 'All']
const complBins = computed(() => {
  const rows = completeness.value.data || []
  const total = rows.length ? rows[0][2] : 0
  const bins = new Array(BIN_LABELS.length).fill(0)
  for (const [k, proteins] of rows) {
    const b = k >= total ? BIN_LABELS.length - 1 : Math.min(BIN_LABELS.length - 2, Math.ceil((k / total) * 10) - 1)
    bins[Math.max(0, b)] += proteins
  }
  return { bins, total, proteins: rows.reduce((a, r) => a + r[1], 0) }
})
const complChart = computed(() => ({
  labels: BIN_LABELS,
  datasets: [{ label: 'Proteins', data: complBins.value.bins, backgroundColor: chartColor('data'), borderRadius: 3 }],
}))
const complOptions = {
  scales: {
    x: { title: { display: true, text: 'Share of samples the protein is quantified in' } },
    y: { title: { display: true, text: 'Proteins' } },
  },
}
const complSummary = computed(() => {
  const { bins, total, proteins } = complBins.value
  const rows = completeness.value.data || []
  const half = rows.filter(([k]) => k * 2 >= total).reduce((a, r) => a + r[1], 0)
  const pct = (v) => (proteins ? `${((v / proteins) * 100).toFixed(0)} %` : '—')
  return `${proteins.toLocaleString()} protein groups over ${total.toLocaleString()} samples (pooled references left out): ` +
    `${bins[bins.length - 1].toLocaleString()} (${pct(bins[bins.length - 1])}) are quantified in every sample and ` +
    `${half.toLocaleString()} (${pct(half)}) in at least half. Counted before any correction.`
})
const complCsv = () => ({ columns: ['n_samples', 'proteins'], rows: completeness.value.data.map(([k, p]) => [k, p]) })
</script>

<style scoped>
.sm-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.sm-tools { display: inline-flex; align-items: center; gap: 12px; }
.sm-pick { font-size: 13px; color: var(--text-secondary); display: inline-flex; gap: 8px; align-items: center; }
.sm-pick select { font: inherit; padding: 2px 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-primary); }
.sm-note { margin: 0 0 8px; font-size: 13px; color: var(--text-secondary); max-width: 900px; }
.sm-progress { max-width: 420px; margin: 18px 0; }
.sm-plot { position: relative; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.sm-plot svg { display: block; }
.sm-grid line { stroke: var(--border); stroke-width: 1; }
.sm-grid text { font-size: 11px; fill: var(--text-muted); font-family: var(--mono); }
.sm-axis { font-size: 12px; fill: var(--text-secondary); }
.sm-dot { stroke: var(--surface); stroke-width: 1; transition: opacity 0.15s; }
.sm-dot.dim { opacity: 0.12; }
.sm-dot.hot { stroke: var(--text-primary); stroke-width: 2; }
.sm-hit { fill: transparent; }
.sm-corr { position: relative; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.sm-corr canvas { display: block; }
.sm-tip { position: absolute; z-index: 3; display: flex; flex-direction: column; gap: 2px; min-width: 180px; max-width: 320px;
  padding: 8px 10px; border-radius: 8px; background: var(--text-primary); color: var(--surface); font-size: 12px; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .sm-dot { transition: none; } }
</style>
