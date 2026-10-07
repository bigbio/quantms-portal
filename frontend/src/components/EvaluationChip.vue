<template>
  <span v-if="verdict" class="eval-mini" :class="`chip-${verdict}`" :title="`Quality evaluation: ${verdict}`">{{ verdict }}</span>
  <span v-else class="muted">—</span>
</template>

<script setup>
import { ref, watch } from 'vue'
import { fetchEvaluation } from '../utils/evaluation.js'

const props = defineProps({ datasetRef: { type: String, default: null } })
const verdict = ref(null)

watch(() => props.datasetRef, async (refId) => {
  verdict.value = null
  const rec = await fetchEvaluation(refId)
  if (refId === props.datasetRef) verdict.value = rec?.verdict || null
}, { immediate: true })
</script>

<style scoped>
.eval-mini { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border); }
.chip-PASS { color: var(--qual-high); border-color: var(--qual-high); }
.chip-WARN { color: var(--qual-medium); border-color: var(--qual-medium); }
.chip-FAIL, .chip-ERROR { color: var(--qual-low); border-color: var(--qual-low); }
.muted { color: var(--text-muted); }
</style>
