<template>
  <div class="chart-box" :style="{ height: height + 'px' }">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup>
// Thin Chart.js v4 wrapper — the ONE charting dependency in the portal.
// Only the Bar + Doughnut controllers are registered (every stats plot is one of
// those), keeping the tree-shaken bundle small. Colors come from the portal CSS
// variables so light/dark stays consistent; the chart is responsive and destroys
// cleanly on unmount / data change.
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  Chart,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(
  BarController, BarElement,
  DoughnutController, ArcElement,
  CategoryScale, LinearScale,
  Tooltip, Legend,
)

const props = defineProps({
  type: { type: String, default: 'bar' },          // 'bar' | 'doughnut'
  data: { type: Object, required: true },           // Chart.js data object
  options: { type: Object, default: () => ({}) },   // extra Chart.js options (merged)
  height: { type: Number, default: 320 },
})

const canvas = ref(null)
let chart = null

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)
  return (v && v.trim()) || fallback
}

function baseOptions() {
  const grid = cssVar('--border', '#e2e8f0')
  const text = cssVar('--text-secondary', '#64748b')
  const horizontal = props.options.indexAxis === 'y'
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        display: props.type === 'doughnut',
        position: 'right',
        labels: { color: text, boxWidth: 12, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: cssVar('--text-primary', '#0f172a'),
        padding: 10,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : ''
            const val = ctx.parsed[horizontal ? 'x' : 'y'] ?? ctx.parsed
            return `${label}${Number(val).toLocaleString()}`
          },
        },
      },
    },
    scales: props.type === 'doughnut' ? {} : {
      x: {
        grid: { color: grid, display: horizontal },
        ticks: { color: text, font: { size: 11 }, autoSkip: !horizontal, maxRotation: horizontal ? 0 : 40 },
      },
      y: {
        grid: { color: grid, display: !horizontal },
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
    type: props.type,
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
