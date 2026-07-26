<template>
  <div class="protein-boxplot">
    <p v-if="!protein || !row" class="protein-boxplot-empty">Select a protein to see its group means.</p>
    <StatsChart v-else type="bar" :data="chartData" :options="chartOptions" :height="220" />
  </div>
</template>

<script setup>
// Per-group mean bar chart for the currently selected protein — a lightweight
// stand-in for a full boxplot (only the two group means are available in the
// result contract). Cross-linked with VolcanoPlot / DeResultsTable via the
// `protein` prop (the shared `selectedProtein` ref in the parent view).
import { computed } from 'vue'
import StatsChart from './StatsChart.vue'

const props = defineProps({
  protein: { type: String, default: '' },
  row: { type: Object, default: null },
})

const chartData = computed(() => toBoxplotData(props.protein, props.row))
const chartOptions = { plugins: { legend: { display: false } } }
</script>

<script>
// Pure helper — builds a Chart.js bar `data` object from a result row's
// per-group means.
export function toBoxplotData(protein, row) {
  const a = row ? row.mean_group_a : null
  const b = row ? row.mean_group_b : null
  return {
    labels: ['Group A', 'Group B'],
    datasets: [
      {
        label: protein || '',
        data: [a, b],
        backgroundColor: ['#6366f1', '#ef4444'],
      },
    ],
  }
}
</script>

<style scoped>
.protein-boxplot-empty { color: var(--muted, #6b7280); padding: 8px 0; }
</style>
