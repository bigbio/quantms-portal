<template>
  <div class="chart-legend">
    <span v-for="l in items" :key="l.label" class="chart-legend-item"><i :style="{ background: l.colour }" />{{ l.label }}</span>
    <span v-if="note" class="chart-legend-note">{{ note }}</span>
  </div>
</template>

<script setup>
// Colour key for a chart whose bars are coloured by group (see chartGroups.js).
defineProps({
  // [{ label, colour }]
  items: { type: Array, required: true },
  note: { type: String, default: '' },
})
</script>

<style scoped>
.chart-legend { display: flex; gap: 6px 16px; flex-wrap: wrap; margin: -6px 0 12px; min-height: 18px; }
.chart-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.chart-legend-item i { width: 12px; height: 12px; border-radius: 3px; flex: none; }
.chart-legend-note { font-size: 12px; color: var(--text-muted); }
</style>
