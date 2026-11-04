<template>
  <section class="ps">
    <div v-show="view !== 'coexpr'">
    <div class="ps-head">
      <div class="qx-block-label">Across samples</div>
      <QxExport v-if="strip" :name="`${fileStem}-${fileProtein}-samples`" :png="() => plot" :csv="stripCsv" />
    </div>
    <QxProgress v-if="values.loading" label="Reading the protein in every sample…" class="ps-progress" />
    <p v-else-if="values.error" class="notice">{{ values.error }}</p>
    <template v-else-if="strip">
      <p class="ps-note">
        Quantified in {{ strip.quantified.toLocaleString() }} of {{ strip.total.toLocaleString() }} samples<template v-if="colouring">,
        in columns by {{ colouring.title.toLowerCase() }} (quantified / samples under each)</template>; bar = median. {{ designNote(design) }}
      </p>
      <div ref="plot" class="ps-plot" @mouseleave="hover = null">
        <svg v-if="width" :width="width" :height="H" role="img" :aria-label="`${protein} across samples`">
          <g class="ps-grid">
            <g v-for="t in ticks" :key="t">
              <line :x1="PAD_L" :x2="width - PAD_R" :y1="y(t)" :y2="y(t)" />
              <text :x="PAD_L - 6" :y="y(t)" dy="0.32em" text-anchor="end">{{ t }}</text>
            </g>
          </g>
          <text class="ps-axis" :transform="`translate(13 ${(PAD_T + H - PAD_B) / 2}) rotate(-90)`" text-anchor="middle">log2, relative</text>
          <g v-for="g in strip.groups" :key="g.label">
            <circle v-for="p in g.points" :key="p.sample" :cx="p.x" :cy="y(p.v)" r="4" class="ps-dot"
                    :class="{ dim: dimmed(p.sample) }" :style="{ fill: p.colour }" />
            <line v-if="g.points.length" :x1="g.cx - g.w * 0.32" :x2="g.cx + g.w * 0.32" :y1="y(g.median)" :y2="y(g.median)" class="ps-median" />
            <text :x="g.cx" :y="H - PAD_B + 15" text-anchor="middle" class="ps-group">{{ fit(g.label, g.w) }}</text>
            <text :x="g.cx" :y="H - PAD_B + 29" text-anchor="middle" class="ps-count">{{ g.points.length }} / {{ g.size }}</text>
          </g>
          <circle v-for="p in strip.points" :key="`h${p.sample}`" :cx="p.x" :cy="y(p.v)" r="8" class="ps-hit" @mouseenter="hover = p" />
        </svg>
        <div v-if="hover" class="ps-tip" :style="tipStyle">
          <strong>{{ hover.sample }}</strong>
          <span v-if="colouring">{{ colouring.title }}: {{ colouring.value(hover.sample) ?? 'not annotated' }}</span>
          <span>{{ hover.v.toFixed(3) }}</span>
        </div>
      </div>
    </template>
    </div>

    <div v-show="view !== 'samples'">
    <div class="ps-head" :class="{ 'ps-coexpr-head': view === 'all' }">
      <div class="qx-block-label">Co-expressed proteins</div>
      <QxExport v-if="coexpr.rows && coexpr.rows.length" :name="`${fileStem}-${fileProtein}-coexpression`" :csv="coexprCsv" />
    </div>
    <p v-if="analysedCount < MIN_SHARED" class="qx-hint">Co-expression needs at least {{ MIN_SHARED }} samples.</p>
    <template v-else>
      <p class="ps-note">
        Pearson r of the values above with every other protein’s, over the samples both are quantified in (at least
        {{ MIN_SHARED }} and half of this protein’s); the ten strongest of each sign. Correlation within one dataset is not evidence of interaction.
      </p>
      <QxProgress v-if="coexpr.loading" label="Correlating with every other protein…" class="ps-progress" />
      <p v-else-if="coexpr.error" class="notice">{{ coexpr.error }}</p>
      <QxTable v-else-if="coexpr.rows" :columns="['protein', 'name', 'r', 'shared_samples']" :rows="coexpr.rows" sort-key="r" row-key="protein"
               empty-text="No protein shares enough samples with this one.">
        <template #cell="{ column, value, text }">
          <button v-if="column === 'protein'" class="qx-link" @click="$emit('open-protein', value)">{{ text }}</button>
          <template v-else>{{ text }}</template>
        </template>
      </QxTable>
    </template>
    </div>
  </section>
</template>

<script setup>
// One protein across samples, in columns by the annotation the page is coloured
// by, and the proteins whose values follow it (co-expression).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import QxExport from './QxExport.vue'
import QxProgress from './QxProgress.vue'
import QxTable from './QxTable.vue'
import { qpxAnalysisSql, qpxProteinNames } from '../qpx.js'
import { coexpressionSql, designNote, isReference, MIN_SHARED, proteinSql } from '../qpxAnalysis.js'
import { NOT_ANNOTATED } from '../sampleColors.js'
import { chartColor } from '../utils/chartColors.js'
import { niceTicks } from '../utils/format.js'

const props = defineProps({
  datasetRef: { type: String, required: true },
  design: { type: Object, required: true },
  protein: { type: String, required: true },
  samples: { type: Array, required: true },
  // 'samples' or 'coexpr' shows one part; both stay mounted so switching keeps their results.
  view: { type: String, default: 'all' },
  colouring: { type: Object, default: null },
})
defineEmits(['open-protein'])

const H = 280
const PAD_L = 52
const PAD_R = 12
const PAD_T = 12
const PAD_B = 40

const fileStem = computed(() => props.datasetRef.replace('/', '_'))
const fileProtein = computed(() => props.protein.replace(/[^\w.-]+/g, '_'))
const analysed = computed(() => props.samples.filter((s) => !isReference(s)).map((s) => s.sample_accession))
const analysedCount = computed(() => analysed.value.length)

const values = ref({ loading: false, error: '', rows: null })
const coexpr = ref({ loading: false, error: '', rows: null })

function load() {
  const r = props.datasetRef
  const prot = props.protein
  const current = () => r === props.datasetRef && prot === props.protein
  values.value = { loading: true, error: '', rows: null }
  qpxAnalysisSql(r, proteinSql(props.design, prot)).then((d) => {
    if (current()) values.value = { loading: false, error: '', rows: d.rows }
  }).catch((e) => {
    if (current()) values.value = { loading: false, error: e.message || 'could not read the protein', rows: null }
  })
  if (analysedCount.value < MIN_SHARED) return
  coexpr.value = { loading: true, error: '', rows: null }
  Promise.all([qpxAnalysisSql(r, coexpressionSql(props.design, prot)), qpxProteinNames(r)]).then(([d, names]) => {
    if (current()) {
      coexpr.value = { loading: false, error: '', rows: d.rows.map(([p, rr, k]) => ({ protein: p, name: names.get(p) ?? null, r: rr, shared_samples: k })) }
    }
  }).catch((e) => {
    if (current()) coexpr.value = { loading: false, error: e.message || 'could not correlate the protein', rows: null }
  })
}
watch(() => [props.datasetRef, props.protein], load, { immediate: true })

const plot = ref(null)
const width = ref(0)
let observer = null
watch(plot, (el) => {
  if (observer) observer.disconnect()
  if (!el) return
  width.value = el.clientWidth
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(([e]) => { width.value = Math.round(e.contentRect.width) })
    observer.observe(el)
  }
})
onBeforeUnmount(() => observer && observer.disconnect())

const valueOf = (s) => (props.colouring ? props.colouring.value(s) : null)
const splitOf = (s) => (props.colouring ? props.colouring.scale.splitOf(valueOf(s)) : 'All samples')
const rankOf = (s) => (props.colouring ? props.colouring.scale.rankOf(valueOf(s)) : 0)

const strip = computed(() => {
  const rows = values.value.rows
  if (!rows || !width.value) return rows ? { groups: [], points: [], quantified: rows.length, total: analysedCount.value } : null
  const size = new Map()
  for (const s of analysed.value) size.set(splitOf(s), (size.get(splitOf(s)) || 0) + 1)
  const keyed = new Map()
  for (const s of analysed.value) {
    const g = splitOf(s)
    if (!keyed.has(g)) keyed.set(g, { label: g, rank: g === NOT_ANNOTATED ? 1e9 : rankOf(s), rows: [] })
  }
  for (const [sample, v] of rows) keyed.get(splitOf(sample))?.rows.push({ sample, v })
  const list = [...keyed.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
  const w = (width.value - PAD_L - PAD_R) / Math.max(1, list.length)
  const groups = list.map((g, gi) => {
    const cx = PAD_L + (gi + 0.5) * w
    const sorted = g.rows.map((p) => p.v).sort((a, b) => a - b)
    const mid = sorted.length >> 1
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    // golden-ratio offsets spread the dots across the column without random jitter
    const points = g.rows.map((p, j) => ({
      ...p,
      x: cx + (((j * 0.618034) % 1) - 0.5) * w * 0.6,
      colour: props.colouring ? props.colouring.scale.colourOf(valueOf(p.sample)) : chartColor('pooled'),
    }))
    return { label: g.label, size: size.get(g.label), cx, w, median, points }
  })
  return { groups, points: groups.flatMap((g) => g.points), quantified: rows.length, total: analysedCount.value }
})

const domain = computed(() => {
  const vs = (values.value.rows || []).map((r) => r[1])
  if (!vs.length) return [0, 1]
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  const pad = (hi - lo) * 0.08 || 0.5
  return [lo - pad, hi + pad]
})
const y = (v) => PAD_T + (1 - (v - domain.value[0]) / (domain.value[1] - domain.value[0])) * (H - PAD_T - PAD_B)
const ticks = computed(() => niceTicks(...domain.value))
const fit = (label, w) => {
  const max = Math.max(3, Math.floor(w / 6.4))
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}
const dimmed = (s) => {
  const h = props.colouring?.highlight
  return !!h && !props.colouring.scale.matches(valueOf(s), h)
}

const hover = ref(null)
const tipStyle = computed(() => {
  const p = hover.value
  const side = p.x > width.value * 0.65 ? { right: `${width.value - p.x + 12}px` } : { left: `${p.x + 12}px` }
  return { ...side, top: `${Math.max(4, y(p.v) - 20)}px` }
})

function stripCsv() {
  const columns = ['sample', ...(props.colouring ? [props.colouring.key] : []), 'value']
  return { columns, rows: values.value.rows.map(([s, v]) => [s, ...(props.colouring ? [valueOf(s)] : []), v]) }
}
const coexprCsv = () => ({ columns: ['protein', 'name', 'r', 'shared_samples'], rows: coexpr.value.rows })
</script>

<style scoped>
.ps-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.ps-coexpr-head { margin-top: 16px; }
.ps-note { margin: 0 0 8px; font-size: 12px; color: var(--text-muted); max-width: 900px; }
.ps-progress { max-width: 420px; margin: 12px 0; }
.ps-plot { position: relative; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); margin-bottom: 4px; }
.ps-plot svg { display: block; }
.ps-grid line { stroke: var(--border); }
.ps-grid text, .ps-count { font-size: 11px; fill: var(--text-muted); font-family: var(--mono); }
.ps-group { font-size: 11px; fill: var(--text-secondary); }
.ps-axis { font-size: 11px; fill: var(--text-muted); }
.ps-dot { stroke: var(--surface); stroke-width: 1; transition: opacity 0.15s; }
.ps-dot.dim { opacity: 0.12; }
.ps-median { stroke: var(--text-primary); stroke-width: 2; opacity: 0.75; }
.ps-hit { fill: transparent; }
.ps-tip { position: absolute; z-index: 3; display: flex; flex-direction: column; gap: 2px; min-width: 180px; max-width: 320px;
  padding: 8px 10px; border-radius: 8px; background: var(--text-primary); color: var(--surface); font-size: 12px; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .ps-dot { transition: none; } }
</style>
