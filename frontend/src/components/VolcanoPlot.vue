<template>
  <div class="volcano-plot">
    <ScatterChart :data="chartData" @point-click="onPointClick" />
  </div>
</template>

<script setup>
// Volcano plot for a differential-expression contrast: log2FC on x,
// -log10(adj p-value) on y, split into up-regulated / down-regulated /
// non-significant datasets so they can be colored and toggled independently
// via the chart legend. Clicking a point drives the shared protein selection.
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
import { regulationClass, REGULATION_META, REGULATION_ORDER } from '../utils/regulation.js'

// Pure helper — builds a Chart.js scatter `data` object from contract rows,
// splitting points into three datasets by regulation direction: "Up" (red),
// "Down" (blue) and "Not significant" (grey), the conventional volcano
// reading. Datasets are always present (possibly empty) and always in
// REGULATION_ORDER, so the legend is stable across contrasts.
// Rows with a non-finite -log10(adj_pvalue) (adj_pvalue null/<=0) are skipped
// since they cannot be plotted on a log scale.
export function toVolcanoData(rows) {
  const byClass = { up: [], down: [], ns: [] }
  for (const row of rows || []) {
    const p = row.adj_pvalue
    if (p === null || p === undefined || !(p > 0)) continue
    const y = -Math.log10(p)
    if (!Number.isFinite(y)) continue
    byClass[regulationClass(row)].push({ x: row.log2fc, y, protein: row.protein })
  }
  return {
    datasets: REGULATION_ORDER.map((key) => ({
      label: REGULATION_META[key].short,
      data: byClass[key],
      backgroundColor: REGULATION_META[key].color,
      borderColor: REGULATION_META[key].color,
    })),
  }
}
</script>

<style scoped>
.volcano-plot {
  width: 100%;
}
</style>
