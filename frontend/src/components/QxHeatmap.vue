<template>
  <section class="hm">
    <p class="qx-hint">
      Name up to {{ MAX }} proteins by accession, UniProt entry name or gene (where the dataset has gene names), separated by
      spaces, commas or lines. Each row is one protein group, scaled to its own mean and standard deviation across samples
      (z-score); a blank cell is a sample it was not quantified in. {{ designNote(design) }}
    </p>
    <div class="hm-form">
      <textarea v-model="text" rows="3" class="qx-input hm-input" spellcheck="false" placeholder="e.g. P07900 P08238 HS90B_HUMAN" />
      <button class="page-btn primary" :disabled="!tokens.length || state.loading" @click="run">{{ state.loading ? 'Drawing…' : 'Draw heatmap' }}</button>
    </div>
    <p v-if="tokens.length > MAX" class="qx-hint">Only the first {{ MAX }} names are used.</p>

    <QxProgress v-if="state.loading" label="Reading the proteins in every sample…" class="hm-progress" />
    <p v-else-if="state.error" class="notice">{{ state.error }}</p>
    <template v-else-if="heat">
      <div class="hm-head">
        <p class="hm-note">
          {{ heat.rows.length.toLocaleString() }} protein group{{ heat.rows.length === 1 ? '' : 's' }} × {{ heat.samples.length.toLocaleString() }} samples,
          samples in legend order<template v-if="colouring"> (the strip gives each sample’s {{ colouring.title.toLowerCase() }})</template>.
          <template v-if="heat.missing.length">Not found: <span class="qx-mono">{{ heat.missing.join(', ') }}</span>.</template>
        </p>
        <QxExport v-if="heat.rows.length" :name="`${fileStem}-heatmap`" :png="() => canvas" :csv="heatCsv" />
      </div>
      <p v-if="!heat.rows.length" class="qx-hint">None of these names is a protein group of this dataset.</p>
      <div v-else ref="wrap" class="hm-plot" @mouseleave="cell = null">
        <canvas ref="canvas" @mousemove="onMove" />
        <div v-if="cell" class="hm-tip" :style="cell.style">
          <strong>{{ cell.label }}</strong>
          <span class="qx-mono">{{ cell.protein }}</span>
          <span>{{ cell.sample }}<template v-if="colouring"> · {{ colouring.value(cell.sample) ?? 'not annotated' }}</template></span>
          <span>{{ cell.v == null ? 'not quantified' : `value ${cell.v.toFixed(2)} · z ${cell.z.toFixed(2)}` }}</span>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
// Several proteins across samples: a protein × sample heatmap of z-scores, the
// samples in the page's legend order under an annotation strip. The names live in
// the URL (?hm=a,b,c, written by the page on `query`) so a heatmap can be shared,
// and it is drawn on opening.
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import QxExport from './QxExport.vue'
import QxProgress from './QxProgress.vue'
import { qpxAnalysisSql, qpxProteinNames } from '../qpx.js'
import { designNote, heatmapSql, isReference } from '../qpxAnalysis.js'
import { orderByGroup } from '../sampleColors.js'
import { chartColor, DIVERGING_MID, mix } from '../utils/chartColors.js'
import { REGULATION_META } from '../utils/regulation.js'

const props = defineProps({
  datasetRef: { type: String, required: true },
  design: { type: Object, required: true },
  samples: { type: Array, required: true },
  colouring: { type: Object, default: null },
})
const emit = defineEmits(['query'])

const MAX = 50
const route = useRoute()
const fileStem = computed(() => props.datasetRef.replace('/', '_'))

const text = ref('')
const tokens = computed(() => [...new Set(text.value.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))])

const state = ref({ loading: false, error: '' })
const result = shallowRef(null)
let seq = 0

async function run() {
  const r = props.datasetRef
  const mine = ++seq
  const names = tokens.value.slice(0, MAX)
  emit('query', { hm: names.join(',') })
  state.value = { loading: true, error: '' }
  try {
    const [d, labels] = await Promise.all([qpxAnalysisSql(r, heatmapSql(props.design, names)), qpxProteinNames(r)])
    if (mine !== seq) return
    result.value = { names, rows: d.rows, labels }
    state.value = { loading: false, error: '' }
  } catch (e) {
    if (mine !== seq) return
    state.value = { loading: false, error: e.message || 'could not read these proteins' }
  }
}

watch(() => props.datasetRef, () => {
  result.value = null
  text.value = typeof route.query.hm === 'string' ? route.query.hm.split(',').join(' ') : ''
  if (tokens.value.length) run()
}, { immediate: true })

const heat = computed(() => {
  const res = result.value
  if (!res) return null
  const found = new Set(res.rows.flatMap(([, matched]) => matched.map((m) => m.toUpperCase())))
  const rank = (row) => Math.min(...row[1].map((m) => res.names.findIndex((x) => x.toUpperCase() === m.toUpperCase())).filter((i) => i >= 0))
  const rows = [...res.rows].sort((a, b) => rank(a) - rank(b) || a[0].localeCompare(b[0])).map(([protein, , samples, v]) => {
    const values = new Map(samples.map((s, i) => [s, v[i]]))
    const vs = [...values.values()]
    const mean = vs.reduce((a, x) => a + x, 0) / vs.length
    const sd = Math.sqrt(vs.reduce((a, x) => a + (x - mean) ** 2, 0) / Math.max(1, vs.length - 1))
    return { protein, label: res.labels.get(protein) || protein, values, z: (x) => (sd > 0 ? (x - mean) / sd : 0) }
  })
  const analysed = props.samples.filter((s) => !isReference(s)).map((s) => s.sample_accession)
  return { rows, samples: orderByGroup(analysed, props.colouring), missing: res.names.filter((n) => !found.has(n.toUpperCase())) }
})

// --- drawing ---
const wrap = ref(null)
const canvas = ref(null)
const ROW = 16
const STRIP = 8
const GAP = 3
const LEGEND = 34
let geom = null

function drawHeatmap() {
  const h = heat.value
  const el = canvas.value
  if (!h || !h.rows.length || !el || !wrap.value) return
  const ctx = el.getContext('2d')
  const font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.font = font
  const labelW = Math.min(180, Math.ceil(Math.max(...h.rows.map((r) => ctx.measureText(r.label).width))) + 10)
  const avail = wrap.value.clientWidth - 22 - labelW
  const cellW = Math.max(1, Math.min(24, avail / h.samples.length))
  const top = STRIP + GAP
  const cssW = Math.ceil(labelW + cellW * h.samples.length)
  const cssH = top + ROW * h.rows.length + LEGEND
  const dpr = window.devicePixelRatio || 1
  el.width = cssW * dpr
  el.height = cssH * dpr
  el.style.width = `${cssW}px`
  el.style.height = `${cssH}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)
  const up = Array.from({ length: 51 }, (_, i) => mix(DIVERGING_MID, REGULATION_META.up.color, i / 50))
  const down = Array.from({ length: 51 }, (_, i) => mix(DIVERGING_MID, REGULATION_META.down.color, i / 50))
  const colourAt = (z) => {
    const t = Math.round((Math.min(3, Math.abs(z)) / 3) * 50)
    return z >= 0 ? up[t] : down[t]
  }
  h.samples.forEach((s, j) => {
    ctx.fillStyle = props.colouring ? props.colouring.scale.colourOf(props.colouring.value(s)) : chartColor('pooled')
    ctx.fillRect(labelW + j * cellW, 0, cellW + 0.3, STRIP)
  })
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#424a53'
  ctx.textBaseline = 'middle'
  h.rows.forEach((r, i) => {
    const y = top + i * ROW
    ctx.fillStyle = ink
    ctx.textAlign = 'left'
    let label = r.label
    while (label.length > 3 && ctx.measureText(label).width > labelW - 10) label = `${label.slice(0, -2)}…`
    ctx.fillText(label, 0, y + ROW / 2)
    h.samples.forEach((s, j) => {
      const v = r.values.get(s)
      if (v == null) return
      ctx.fillStyle = colourAt(r.z(v))
      ctx.fillRect(labelW + j * cellW, y + 1, cellW + 0.3, ROW - 2)
    })
  })
  // legend: z from -3 to +3, beyond which colours stay at their end
  const ly = top + ROW * h.rows.length + 12
  const lw = 180
  const grad = ctx.createLinearGradient(labelW, 0, labelW + lw, 0)
  for (let i = 0; i <= 10; i++) grad.addColorStop(i / 10, colourAt(-3 + (6 * i) / 10))
  ctx.fillStyle = grad
  ctx.fillRect(labelW, ly, lw, 8)
  ctx.fillStyle = ink
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText('z −3', labelW, ly + 11)
  ctx.textAlign = 'center'
  ctx.fillText('0', labelW + lw / 2, ly + 11)
  ctx.textAlign = 'right'
  ctx.fillText('+3', labelW + lw, ly + 11)
  ctx.textAlign = 'left'
  ctx.fillText('blank: not quantified', labelW + lw + 16, ly - 1)
  geom = { labelW, cellW, top }
}

watch([heat, canvas], () => nextTick(drawHeatmap))
watch(() => props.colouring, () => nextTick(drawHeatmap))

const cell = ref(null)
function onMove(ev) {
  if (!geom) return
  const { labelW, cellW, top } = geom
  const h = heat.value
  const i = Math.floor((ev.offsetY - top) / ROW)
  const j = Math.floor((ev.offsetX - labelW) / cellW)
  if (i < 0 || j < 0 || i >= h.rows.length || j >= h.samples.length) { cell.value = null; return }
  const r = h.rows[i]
  const sample = h.samples[j]
  const v = r.values.get(sample)
  const w = wrap.value.clientWidth
  const side = ev.offsetX > w * 0.6 ? { right: `${w - ev.offsetX + 14}px` } : { left: `${ev.offsetX + 14}px` }
  cell.value = { label: r.label, protein: r.protein, sample, v: v ?? null, z: v == null ? 0 : r.z(v), style: { ...side, top: `${ev.offsetY + 14}px` } }
}

function heatCsv() {
  const h = heat.value
  return {
    columns: ['protein', 'name', ...h.samples],
    rows: h.rows.map((r) => [r.protein, r.label, ...h.samples.map((s) => r.values.get(s) ?? null)]),
  }
}
</script>

<style scoped>
.hm-form { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 10px; }
.hm-input { flex: 1 1 420px; min-height: 64px; resize: vertical; font-size: 13px; }
.hm-progress { max-width: 420px; margin: 18px 0; }
.hm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px 20px; flex-wrap: wrap; }
.hm-note { margin: 0 0 8px; font-size: 13px; color: var(--text-secondary); max-width: 860px; }
.hm-plot { position: relative; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); overflow-x: auto; }
.hm-plot canvas { display: block; }
.hm-tip { position: absolute; z-index: 3; display: flex; flex-direction: column; gap: 2px; min-width: 180px; max-width: 340px;
  padding: 8px 10px; border-radius: 8px; background: var(--text-primary); color: var(--surface); font-size: 12px; pointer-events: none; }
</style>
