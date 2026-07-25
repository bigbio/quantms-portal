<template>
  <div class="de-heatmap">
    <p v-if="!topRows.length" class="de-heatmap-empty">No results to display.</p>
    <div v-else class="de-heatmap-wrap">
      <canvas ref="canvas" :width="canvasWidth" :height="canvasHeight" role="img"
              :aria-label="`Heatmap of the top ${topRows.length} proteins by adjusted p-value`"></canvas>
    </div>
  </div>
</template>

<script setup>
// Small dependency-free canvas heatmap of the top-N (by adjusted p-value)
// proteins' per-group means, z-scored per-row (across the two group means)
// so each protein's own color scale is comparable regardless of absolute
// intensity. Drawn with the raw canvas 2D API — no new chart dep needed for
// a two-column heatmap. jsdom doesn't implement canvas 2D contexts, so
// `render()` no-ops (rather than throws) when `getContext('2d')` returns
// null — the component still mounts fine in tests.
import { ref, computed, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  topN: { type: Number, default: 30 },
})

const ROW_H = 16
const COL_W = 90
const LABEL_W = 100
const HEADER_H = 20

const canvas = ref(null)
const topRows = computed(() => topByAdjP(props.rows, props.topN))
const canvasWidth = computed(() => LABEL_W + COL_W * 2)
const canvasHeight = computed(() => HEADER_H + topRows.value.length * ROW_H)

function zPair(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return [null, null]
  if (Number.isNaN(a) || Number.isNaN(b)) return [null, null]
  const mean = (a + b) / 2
  const sd = Math.sqrt(((a - mean) ** 2 + (b - mean) ** 2) / 2)
  if (!sd) return [0, 0]
  return [(a - mean) / sd, (b - mean) / sd]
}

// Diverging blue (low) -> white (0) -> red (high) scale, clamped to +/-2 sd.
function colorForZ(z) {
  if (z === null || z === undefined || !Number.isFinite(z)) return '#e5e7eb'
  const t = Math.max(-2, Math.min(2, z)) / 2
  if (t >= 0) {
    const c = Math.round(255 - t * 190)
    return `rgb(255, ${c}, ${c})`
  }
  const c = Math.round(255 + t * 190)
  return `rgb(${c}, ${c}, 255)`
}

function render() {
  const el = canvas.value
  if (!el || typeof el.getContext !== 'function') return
  const ctx = el.getContext('2d')
  if (!ctx) return // no 2D canvas support (e.g. jsdom in tests) — nothing to draw
  ctx.clearRect(0, 0, el.width, el.height)
  ctx.font = '10px sans-serif'
  ctx.textBaseline = 'middle'
  topRows.value.forEach((row, i) => {
    const y = i * ROW_H
    const [za, zb] = zPair(row.mean_group_a, row.mean_group_b)
    ctx.fillStyle = colorForZ(za)
    ctx.fillRect(LABEL_W, y, COL_W, ROW_H - 1)
    ctx.fillStyle = colorForZ(zb)
    ctx.fillRect(LABEL_W + COL_W, y, COL_W, ROW_H - 1)
    ctx.fillStyle = '#111827'
    ctx.fillText(row.protein || '', 2, y + ROW_H / 2, LABEL_W - 4)
  })
  const headerY = topRows.value.length * ROW_H + HEADER_H / 2
  ctx.fillStyle = '#374151'
  ctx.fillText('Group A', LABEL_W + 4, headerY, COL_W - 4)
  ctx.fillText('Group B', LABEL_W + COL_W + 4, headerY, COL_W - 4)
}

onMounted(() => nextTick(render))
watch(topRows, () => nextTick(render))
</script>

<script>
// Pure helper — the n rows with the smallest `adj_pvalue`, nulls/undefined
// last, preserving the input order among ties (a stable sort keyed by the
// original index breaks ties).
export function topByAdjP(rows, n) {
  const indexed = (rows || []).map((r, i) => ({ r, i }))
  indexed.sort((a, b) => {
    const av = a.r ? a.r.adj_pvalue : undefined
    const bv = b.r ? b.r.adj_pvalue : undefined
    const aNull = av === null || av === undefined
    const bNull = bv === null || bv === undefined
    if (aNull && bNull) return a.i - b.i
    if (aNull) return 1
    if (bNull) return -1
    if (av === bv) return a.i - b.i
    return av - bv
  })
  return indexed.slice(0, n).map((x) => x.r)
}
</script>

<style scoped>
.de-heatmap-empty { color: var(--muted, #6b7280); padding: 8px 0; }
.de-heatmap-wrap { overflow-x: auto; }
</style>
