<template>
  <span class="qe">
    <button v-if="png" type="button" class="qe-btn" title="Download the chart as a PNG image" @click="savePng">PNG</button>
    <button v-if="csv" type="button" class="qe-btn" title="Download the data behind the chart as CSV" @click="saveCsv">CSV</button>
  </span>
</template>

<script setup>
// PNG and CSV downloads for one chart.
import { downloadCsv, downloadPng } from '../utils/exportChart.js'

const props = defineProps({
  // file name, without extension
  name: { type: String, required: true },
  // () => the element holding the chart (a canvas or an svg)
  png: { type: Function, default: null },
  // () => ({ columns, rows })
  csv: { type: Function, default: null },
})

const savePng = () => downloadPng(props.png(), props.name)
function saveCsv() {
  const { columns, rows } = props.csv()
  downloadCsv(columns, rows, props.name)
}
</script>

<style scoped>
.qe { display: inline-flex; gap: 4px; }
.qe-btn { font: inherit; font-size: 11px; font-weight: 600; letter-spacing: .03em; padding: 2px 8px; border: 1px solid var(--border);
  border-radius: 5px; background: var(--surface); color: var(--text-secondary); cursor: pointer; }
.qe-btn:hover, .qe-btn:focus-visible { border-color: var(--indigo); color: var(--indigo); outline: none; }
</style>
