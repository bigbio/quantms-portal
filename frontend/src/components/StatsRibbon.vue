<template>
  <section class="stats-ribbon">
    <div class="stats-inner">
      <template v-for="(item, idx) in visibleStats" :key="item.label">
        <div v-if="idx > 0" class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value">{{ item.display }}</div>
          <div class="stat-label">{{ item.label }}</div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { formatBig } from '../utils/format.js'

const props = defineProps({
  stats: {
    type: Object,
    required: true
  }
})

// Non-numeric values render as nothing (formatBig would show an em-dash).
function fmt(n) {
  return typeof n === 'number' ? formatBig(n) : null
}

const visibleStats = computed(() => {
  const s = props.stats
  const items = []
  if (s.total_collections != null) items.push({ label: 'Collections', display: s.total_collections })
  if (s.total_datasets != null) items.push({ label: 'Datasets', display: fmt(s.total_datasets) })
  if (s.total_features) items.push({ label: 'Features', display: fmt(s.total_features) })
  if (s.total_psms) items.push({ label: 'PSMs', display: fmt(s.total_psms) })
  if (s.total_proteins) items.push({ label: 'Proteins', display: fmt(s.total_proteins) })
  if (s.total_peptides) items.push({ label: 'Peptides', display: fmt(s.total_peptides) })
  if (s.total_runs) items.push({ label: 'Runs', display: fmt(s.total_runs) })
  if (s.total_samples) items.push({ label: 'Samples', display: fmt(s.total_samples) })
  return items
})
</script>
