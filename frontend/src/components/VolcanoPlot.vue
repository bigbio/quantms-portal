<template>
  <div class="volcano-plot">
    <ScatterChart :data="chartData" @point-click="onPointClick" />
  </div>
</template>

<script setup>
// Volcano plot for a differential-expression contrast: log2FC on x,
// -log10(adj p-value) on y, split into significant / non-significant
// datasets so they can be colored and toggled independently via the
// chart legend. Clicking a point drives the shared protein selection.
import { computed } from 'vue'
import ScatterChart from './ScatterChart.vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])

const chartData = computed(() => toVolcanoData(props.rows))

function onPointClick(datum) {
  if (datum && datum.protein) emit('select', datum.protein)
}
</script>

<script>
// Pure helper — builds a Chart.js scatter `data` object from contract rows,
// splitting points into a "Significant" and "Not significant" dataset.
// Rows with a non-finite -log10(adj_pvalue) (adj_pvalue null/<=0) are skipped
// since they cannot be plotted on a log scale.
export function toVolcanoData(rows) {
  const significant = []
  const other = []
  for (const row of rows || []) {
    const p = row.adj_pvalue
    if (p === null || p === undefined || !(p > 0)) continue
    const y = -Math.log10(p)
    if (!Number.isFinite(y)) continue
    const point = { x: row.log2fc, y, protein: row.protein }
    if (row.significant) significant.push(point)
    else other.push(point)
  }
  return {
    datasets: [
      {
        label: 'Significant',
        data: significant,
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
      },
      {
        label: 'Not significant',
        data: other,
        backgroundColor: '#94a3b8',
        borderColor: '#94a3b8',
      },
    ],
  }
}
</script>

<style scoped>
.volcano-plot {
  width: 100%;
}
</style>
