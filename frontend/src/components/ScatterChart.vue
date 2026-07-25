<template>
  <div class="chart-box" :style="{ height: height + 'px' }">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup>
// Thin Chart.js v4 scatter wrapper — used by the volcano plot + PCA views.
// Only the scatter/point pieces are registered, keeping the tree-shaken bundle
// small. Colors come from the portal CSS variables so light/dark stays
// consistent; the chart is responsive, destroys cleanly on unmount / data
// change, and emits the clicked datum so callers can drive a selection.
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  Chart,
  ScatterController,
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(
  ScatterController, PointElement,
  LinearScale,
  Tooltip, Legend,
)

const props = defineProps({
  data: { type: Object, required: true },           // Chart.js scatter data object
  options: { type: Object, default: () => ({}) },   // extra Chart.js options (merged)
  height: { type: Number, default: 340 },
})

const emit = defineEmits(['point-click'])

const canvas = ref(null)
let chart = null

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)
  return (v && v.trim()) || fallback
}

function handleClick(event, elements, chartInstance) {
  if (!elements || !elements.length) return
  const el = elements[0]
  const datum = chartInstance.data.datasets[el.datasetIndex].data[el.index]
  emit('point-click', datum)
}

function baseOptions() {
  const grid = cssVar('--border', '#e2e8f0')
  const text = cssVar('--text-secondary', '#64748b')
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    onClick(event, elements, chartInstance) {
      handleClick(event, elements, chartInstance)
    },
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: { color: text, boxWidth: 12, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: cssVar('--text-primary', '#0f172a'),
        padding: 10,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      x: {
        grid: { color: grid },
        ticks: { color: text, font: { size: 11 } },
      },
      y: {
        grid: { color: grid },
        ticks: { color: text, font: { size: 11 } },
      },
    },
  }
}

function deepMerge(a, b) {
  const out = { ...a }
  for (const k of Object.keys(b || {})) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) out[k] = deepMerge(a[k] || {}, b[k])
    else out[k] = b[k]
  }
  return out
}

function render() {
  if (!canvas.value) return
  if (chart) { chart.destroy(); chart = null }
  chart = new Chart(canvas.value, {
    type: 'scatter',
    data: props.data,
    options: deepMerge(baseOptions(), props.options),
  })
}

onMounted(render)
watch(() => props.data, render, { deep: true })
onBeforeUnmount(() => { if (chart) { chart.destroy(); chart = null } })
</script>

<style scoped>
.chart-box {
  position: relative;
  width: 100%;
}
</style>
