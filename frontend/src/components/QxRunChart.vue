<template>
  <figure class="rc">
    <div class="rc-head">
      <label class="rc-pick">
        Metric
        <select v-model="metric">
          <option v-for="m in metrics" :key="m" :value="m">{{ colLabel(m) }}</option>
        </select>
      </label>
      <p class="rc-note">
        One dot per run<template v-if="groupMode === 'fraction'">, in columns by fraction (each run is judged against its fraction)</template><template v-else-if="groupMode === 'colour'">, in columns by {{ colouring.title.toLowerCase() }}</template>;
        bar = median. <span class="rc-ring" aria-hidden="true" /> flagged on this metric: {{ nFlagged.toLocaleString() }}.
        <template v-if="allMixed">Each run holds several samples with different {{ colouring.title.toLowerCase() }}, so runs are not coloured by it.</template>
        Click a dot to find the run in the table.
      </p>
    </div>
    <div ref="wrap" class="rc-plot" @mouseleave="hover = null">
      <svg v-if="width" :width="width" :height="H" role="img" :aria-label="`${colLabel(metric)} per run`">
        <g class="rc-grid">
          <g v-for="t in ticks" :key="t">
            <line :x1="PAD_L" :x2="width - PAD_R" :y1="y(t)" :y2="y(t)" />
            <text :x="PAD_L - 6" :y="y(t)" dy="0.32em" text-anchor="end">{{ tickText(t) }}</text>
          </g>
        </g>
        <g v-for="g in groups" :key="g.key">
          <circle
            v-for="p in g.points"
            :key="p.row.run"
            :cx="p.x" :cy="y(p.v)" :r="p.flagged ? 5 : 3.5"
            class="rc-dot"
            :class="{ flagged: p.flagged, dim: dimmed(p), sel: p.row.run === selected }"
            :style="{ fill: p.colour }"
          />
          <line :x1="g.cx - g.w * 0.32" :x2="g.cx + g.w * 0.32" :y1="y(g.median)" :y2="y(g.median)" class="rc-median" />
        </g>
        <g class="rc-hits">
          <circle
            v-for="p in points"
            :key="p.row.run"
            :cx="p.x" :cy="y(p.v)" r="8"
            @mouseenter="hover = p"
            @click="$emit('select', p.row.run)"
          />
        </g>
      </svg>
      <div class="rc-labels" :style="{ paddingLeft: `${PAD_L}px`, paddingRight: `${PAD_R}px` }">
        <span v-for="g in groups" :key="g.key" :title="g.label">{{ g.label }}</span>
      </div>
      <div v-if="hover" class="rc-tip" :style="tipStyle">
        <strong>{{ hover.row.run }}</strong>
        <span>{{ colLabel(metric) }}: {{ formatCell(hover.v, metric).text }}</span>
        <span v-if="hover.row.fraction != null && groupMode === 'fraction'">Fraction {{ hover.row.fraction }}<template v-if="hover.row.plex != null"> · plex {{ hover.row.plex }}</template></span>
        <span v-if="colouring">{{ colouring.title }}: {{ hover.mixed ? 'several' : (hover.value ?? 'not annotated') }}</span>
        <span v-for="f in hover.row.flags" :key="f.metric" class="rc-warn">⚠ {{ colLabel(f.metric) }} {{ f.direction }} (robust z {{ f.z }})</span>
      </div>
    </div>
  </figure>
</template>

<script setup>
// Run QC as a strip chart: one dot per run for the chosen metric, grouped by
// fraction when runs are judged within their fraction, otherwise by the sample
// annotation the page is coloured by. Dots take that annotation's colour when a
// run holds samples of one value (always so without labelling).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { colLabel, formatCell } from '../qpxFormat.js'
import { chartColor } from '../utils/chartColors.js'

const props = defineProps({
  rows: { type: Array, required: true },
  columns: { type: Array, required: true },
  baseline: { type: String, default: '' },
  // { title, scale, run(name) -> { mixed, value }, highlight } or null
  colouring: { type: Object, default: null },
  selected: { type: String, default: '' },
})
defineEmits(['select'])

const H = 260
const PAD_L = 64
const PAD_R = 12
const PAD_T = 12
const PAD_B = 12

const NOT_METRICS = new Set(['run', 'plex', 'fraction', 'flags'])
const metrics = computed(() => props.columns.filter((c) => !NOT_METRICS.has(c) && props.rows.some((r) => Number.isFinite(r[c]))))
const metric = ref('')
watch(metrics, (m) => { if (!m.includes(metric.value)) metric.value = m[0] || '' }, { immediate: true })

const wrap = ref(null)
const width = ref(0)
let observer = null
onMounted(() => {
  width.value = wrap.value.clientWidth
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(([e]) => { width.value = Math.round(e.contentRect.width) })
    observer.observe(wrap.value)
  }
})
onBeforeUnmount(() => observer && observer.disconnect())

const annotated = (row) => (props.colouring ? props.colouring.run(row.run) : { mixed: false, value: null })
const allMixed = computed(() => !!props.colouring && props.rows.length > 0 && props.rows.every((r) => annotated(r).mixed))

const groupMode = computed(() => {
  if (props.baseline === 'same fraction' && new Set(props.rows.map((r) => r.fraction)).size > 1) return 'fraction'
  if (props.colouring && !allMixed.value) return 'colour'
  return 'all'
})

// Runs whose samples differ in the annotation, or with no annotation to go by, are pooled.
function colourOf(a) {
  if (!props.colouring || a.mixed) return chartColor('pooled')
  return props.colouring.scale.colourOf(a.value)
}

const groups = computed(() => {
  const m = metric.value
  const keyed = new Map()
  for (const row of props.rows) {
    const v = row[m]
    if (!Number.isFinite(v)) continue
    const a = annotated(row)
    let key = 'all'
    let label = 'All runs'
    let rank = 0
    if (groupMode.value === 'fraction') {
      key = String(row.fraction)
      label = `F${row.fraction}`
      rank = Number(row.fraction)
    } else if (groupMode.value === 'colour') {
      label = a.mixed ? 'Several values' : props.colouring.scale.splitOf(a.value)
      key = label
      rank = a.mixed ? 1e9 : props.colouring.scale.rankOf(a.value)
    }
    if (!keyed.has(key)) keyed.set(key, { key, label, rank, rows: [] })
    keyed.get(key).rows.push({ row, v, ...a })
  }
  const list = [...keyed.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, undefined, { numeric: true }))
  const w = (width.value - PAD_L - PAD_R) / Math.max(1, list.length)
  return list.map((g, gi) => {
    const cx = PAD_L + (gi + 0.5) * w
    const sorted = g.rows.map((p) => p.v).sort((a, b) => a - b)
    const mid = sorted.length >> 1
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    // golden-ratio offsets spread the dots across the column without random jitter
    const points = g.rows.map((p, j) => ({
      ...p,
      x: cx + (((j * 0.618034) % 1) - 0.5) * w * 0.6,
      colour: colourOf(p),
      flagged: (p.row.flags || []).some((f) => f.metric === m),
    }))
    return { ...g, cx, w, median, points }
  })
})
const points = computed(() => groups.value.flatMap((g) => g.points))
const nFlagged = computed(() => points.value.filter((p) => p.flagged).length)

const domain = computed(() => {
  const vs = points.value.map((p) => p.v)
  if (!vs.length) return [0, 1]
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.1 || 1
  return [lo - pad, hi + pad]
})
const y = (v) => {
  const [lo, hi] = domain.value
  return PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B)
}
const ticks = computed(() => {
  const [lo, hi] = domain.value
  const raw = (hi - lo) / 5
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((s) => s * mag).find((s) => s >= raw)
  const out = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(Number(t.toPrecision(12)))
  return out
})
const tickText = (t) => formatCell(t, metric.value).text

const dimmed = (p) => {
  const h = props.colouring?.highlight
  if (!h) return false
  return p.mixed || !props.colouring.scale.matches(p.value, h)
}

const hover = ref(null)
const tipStyle = computed(() => {
  const p = hover.value
  const left = p.x > width.value * 0.65 ? { right: `${width.value - p.x + 12}px` } : { left: `${p.x + 12}px` }
  return { ...left, top: `${Math.max(4, y(p.v) - 20)}px` }
})
</script>

<style scoped>
.rc { margin: 0 0 14px; }
.rc-head { display: flex; gap: 8px 16px; align-items: baseline; flex-wrap: wrap; margin-bottom: 8px; }
.rc-pick { font-size: 13px; color: var(--text-secondary); white-space: nowrap; display: inline-flex; gap: 8px; align-items: center; }
.rc-pick select { font: inherit; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-primary); }
.rc-note { margin: 0; font-size: 12px; color: var(--text-muted); flex: 1; min-width: 280px; }
.rc-ring { display: inline-block; width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--text-primary); vertical-align: -1px; }
.rc-plot { position: relative; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 6px 0 4px; min-height: 290px; }
.rc-plot svg { display: block; }
.rc-grid line { stroke: var(--border); }
.rc-grid text { font-size: 11px; fill: var(--text-muted); font-family: var(--mono); }
.rc-dot { stroke: var(--surface); stroke-width: 1; transition: opacity 0.15s; }
.rc-dot.flagged { stroke: var(--text-primary); stroke-width: 2; }
.rc-dot.sel { stroke: var(--indigo); stroke-width: 3; }
.rc-dot.dim { opacity: 0.12; }
.rc-median { stroke: var(--text-primary); stroke-width: 2; opacity: 0.75; }
.rc-hits circle { fill: transparent; cursor: pointer; }
.rc-labels { display: flex; font-size: 11px; color: var(--text-muted); font-family: var(--mono); }
.rc-labels span { flex: 1 1 0; min-width: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; }
.rc-tip { position: absolute; z-index: 3; display: flex; flex-direction: column; gap: 2px; min-width: 200px; max-width: 320px;
  padding: 8px 10px; border-radius: 8px; background: var(--text-primary); color: var(--surface); font-size: 12px; pointer-events: none; }
.rc-warn { color: #fbbf24; }
@media (prefers-reduced-motion: reduce) { .rc-dot { transition: none; } }
</style>
