<template>
  <div class="de-qc-panel">
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
import { computed } from 'vue'
import ScatterChart from './ScatterChart.vue'

const props = defineProps({
  qc: { type: Object, default: () => ({ pca: [], norm: {} }) },
})

const scatterData = computed(() => pcaToScatter(props.qc?.pca))
const normLabel = computed(() => props.qc?.norm?.method || '')

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
</script>

<style scoped>
.de-qc-empty { color: var(--muted, #6b7280); padding: 8px 0; }
.de-qc-norm { margin: 8px 0 0; font-size: 13px; color: var(--muted, #6b7280); }
</style>
