<template>
  <span class="quality-badges" :class="{ 'quality-badges--compact': compact }">
    <span
      class="quality-badge"
      :class="`quality-badge--q-${quality.key}`"
      :title="qualityTitle"
      :aria-label="qualityTitle"
    >
      <span v-if="!compact" class="quality-badge-axis">Data quality</span>
      <span class="quality-badge-level">{{ quality.short }}</span>
    </span>
    <span
      class="quality-badge"
      :class="`quality-badge--p-${power.key}`"
      :title="powerTitle"
      :aria-label="powerTitle"
    >
      <span v-if="!compact" class="quality-badge-axis">Statistical power</span>
      <span class="quality-badge-level">{{ power.short }}</span>
    </span>
  </span>
</template>

<script setup>
// The two-axis dataset badge pair: DATA QUALITY (is the measurement
// trustworthy?) next to STATISTICAL POWER (how much can this design detect?).
// They are always rendered together and never collapsed into a single grade —
// see src/utils/quality.js for why.
//
// Purely presentational: both props accept either a bare level string
// ('high') or the backend classification object ({ level, reasons, ... }), and
// an absent/unrecognized value degrades to a neutral "Unknown" badge so
// datasets built before the classification existed still render.
//
// `compact` drops the axis captions for use inside a table row. The level text
// is always present and the full description (plus any backend reasons) rides
// on title/aria-label, so the badge is never color-only.
import { computed } from 'vue'
import { qualityMeta, powerMeta, badgeTitle } from '../utils/quality.js'

const props = defineProps({
  dataQuality: { type: [String, Object], default: null },
  power: { type: [String, Object], default: null },
  compact: { type: Boolean, default: false },
})

const quality = computed(() => qualityMeta(props.dataQuality))
const power = computed(() => powerMeta(props.power))
const qualityTitle = computed(() => badgeTitle(quality.value, props.dataQuality))
const powerTitle = computed(() => badgeTitle(power.value, props.power))
</script>

<style scoped>
.quality-badges {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.quality-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: var(--bg-alt, #f8fafc);
  line-height: 1.4;
  white-space: nowrap;
}

.quality-badge-axis {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.85;
}
.quality-badge-level { font-size: 13px; font-weight: 700; }

.quality-badges--compact .quality-badge { padding: 2px 8px; }
.quality-badges--compact .quality-badge-level { font-size: 12px; }

/* Colors mirror QUALITY_META / POWER_META in src/utils/quality.js via the
   --qual-* / --power-* tokens in src/style.css. */
.quality-badge--q-high { color: var(--qual-high, #047857); }
.quality-badge--q-medium { color: var(--qual-medium, #b45309); }
.quality-badge--q-low { color: var(--qual-low, #dc2626); }
.quality-badge--q-unknown { color: var(--qual-unknown, #64748b); }

.quality-badge--p-strong { color: var(--power-strong, #047857); }
.quality-badge--p-moderate { color: var(--power-moderate, #b45309); }
.quality-badge--p-limited { color: var(--power-limited, #dc2626); }
.quality-badge--p-unknown { color: var(--power-unknown, #64748b); }

@media (max-width: 560px) {
  .quality-badge-axis { display: none; }
}
</style>
