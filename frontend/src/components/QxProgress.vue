<template>
  <div class="qp" role="progressbar" :aria-label="label" aria-valuemin="0" aria-valuemax="100"
       :aria-valuenow="determinate ? Math.round(value * 100) : undefined">
    <div class="qp-track">
      <div v-if="determinate" class="qp-fill" :style="{ width: `${Math.max(4, value * 100)}%` }"></div>
      <div v-else class="qp-indeterminate"></div>
    </div>
    <span v-if="label" class="qp-label">{{ label }}</span>
  </div>
</template>

<script setup>
// Progress bar: determinate when `value` (0–1) is known, a moving bar otherwise.
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: null },
  label: { type: String, default: '' },
})
const determinate = computed(() => props.value != null)
</script>

<style scoped>
.qp { display: flex; flex-direction: column; gap: 6px; }
.qp-track { position: relative; height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; }
.qp-fill { height: 100%; border-radius: 2px; background: var(--indigo); transition: width 0.25s ease; }
.qp-indeterminate { position: absolute; top: 0; bottom: 0; left: 0; width: 35%; border-radius: 2px; background: var(--indigo);
  animation: qp-slide 1.1s ease-in-out infinite; }
.qp-label { font-size: 12px; color: var(--text-muted); }
/* transform, not left: the bar moves without laying the page out every frame */
@keyframes qp-slide { from { transform: translateX(-100%); } to { transform: translateX(286%); } }
@media (prefers-reduced-motion: reduce) { .qp-indeterminate { animation: none; width: 100%; opacity: 0.4; } }
</style>
