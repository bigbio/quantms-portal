<template>
  <div class="de-design-panel">
    <div class="de-field">
      <label for="de-factor">Factor</label>
      <select id="de-factor" v-model="selectedFactor" @change="onFactorChange">
        <option v-for="f in factors" :key="f.name" :value="f.name">{{ f.name }}</option>
      </select>
    </div>

    <div class="de-field">
      <label for="de-contrast">Contrast</label>
      <select id="de-contrast" v-model="selectedContrastId" @change="emitChange">
        <option v-for="c in availableContrasts" :key="c.id" :value="c.id">
          {{ c.group_a }} vs {{ c.group_b }}
        </option>
      </select>
    </div>

    <details class="de-advanced">
      <summary>Advanced configuration</summary>
      <div class="de-field">
        <label for="de-method">Method</label>
        <select id="de-method" v-model="method" @change="emitChange">
          <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <div class="de-field">
        <label for="de-normalization">Normalization</label>
        <select id="de-normalization" v-model="normalization" @change="emitChange">
          <option v-for="n in normalizations" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>

      <div class="de-field">
        <label for="de-level">Level</label>
        <select id="de-level" v-model="level" @change="emitChange">
          <option v-for="l in levels" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>
    </details>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  design: { type: Object, default: () => ({ factors: [], contrasts: [] }) },
  initialContrast: { type: String, default: '' },
  initialMethod: { type: String, default: 'limma' },
  initialNormalization: { type: String, default: 'median' },
  initialLevel: { type: String, default: 'protein' },
})
const emit = defineEmits(['change'])

const methods = ['limma', 'deqms', 'rots', 'limrots', 'proda']
const normalizations = ['median', 'quantile', 'none', 'loess', 'rlr']
const levels = ['protein', 'feature']

const factors = computed(() => props.design?.factors || [])

// Seed from a deep-linked contrast when present: find the factor that owns
// it so the factor <select> and contrast <select> agree from the first
// render, instead of defaulting to the first factor and losing the seed.
function findContrastById(design, id) {
  return (design?.contrasts || []).find((c) => c.id === id) || null
}

const seededContrast = findContrastById(props.design, props.initialContrast)
const selectedFactor = ref(seededContrast?.factor || factors.value[0]?.name || '')
const availableContrasts = computed(() => contrastsForFactor(props.design, selectedFactor.value))
const selectedContrastId = ref(props.initialContrast || availableContrasts.value[0]?.id || '')

const method = ref(props.initialMethod)
const normalization = ref(props.initialNormalization)
const level = ref(props.initialLevel)

function onFactorChange() {
  selectedContrastId.value = availableContrasts.value[0]?.id || ''
  emitChange()
}

function emitChange() {
  const contrast = availableContrasts.value.find((c) => c.id === selectedContrastId.value) || null
  emit('change', {
    contrast,
    method: method.value,
    normalization: normalization.value,
    level: level.value,
  })
}

// Re-seed from `initial*` props when the PARENT pushes new values (browser
// Back/Forward, or a programmatic URL change for the same dataset) — the
// setup-time seed above only runs once, so without this the panel (and the
// results it drives) go stale relative to the URL. Guarded against the echo
// loop that happens when the panel itself is the source of the change: the
// panel emits `change` -> the parent updates its refs -> those refs come back
// down as `initial*` props equal to what the panel already has internally.
// Only re-seed when at least one incoming value actually differs from the
// current internal state; otherwise this is a no-op (no re-seed, no re-emit).
watch(
  () => [props.initialContrast, props.initialMethod, props.initialNormalization, props.initialLevel],
  ([nextContrast, nextMethod, nextNormalization, nextLevel]) => {
    const changed =
      nextContrast !== selectedContrastId.value ||
      nextMethod !== method.value ||
      nextNormalization !== normalization.value ||
      nextLevel !== level.value
    if (!changed) return
    const seeded = findContrastById(props.design, nextContrast)
    selectedFactor.value = seeded?.factor || factors.value[0]?.name || ''
    selectedContrastId.value = nextContrast || availableContrasts.value[0]?.id || ''
    method.value = nextMethod
    normalization.value = nextNormalization
    level.value = nextLevel
    emitChange()
  },
)

watch(
  () => props.design,
  () => {
    // Prefer the factor that owns the currently-selected contrast (covers both
    // a still-valid seeded/user selection, and the case where `design` arrives
    // asynchronously after mount and only now contains the seeded contrast).
    // Only fall back to resetting the factor when that lookup fails.
    const owning = findContrastById(props.design, selectedContrastId.value)
    if (owning) {
      selectedFactor.value = owning.factor
    } else if (!factors.value.find((f) => f.name === selectedFactor.value)) {
      selectedFactor.value = factors.value[0]?.name || ''
    }
    // Don't clobber a still-valid selection (seeded from the URL or chosen by
    // the user) — only reset to the first available contrast when the current
    // one is empty or no longer present among the (possibly new) contrasts.
    if (
      !selectedContrastId.value ||
      !availableContrasts.value.find((c) => c.id === selectedContrastId.value)
    ) {
      selectedContrastId.value = availableContrasts.value[0]?.id || ''
    }
    emitChange()
  },
  { deep: true },
)

emitChange()
</script>

<script>
export function contrastsForFactor(design, factorName) {
  return (design?.contrasts || []).filter((c) => c.factor === factorName)
}
</script>

<style scoped>
.de-design-panel { display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
.de-field { display: flex; flex-direction: column; gap: 4px; }
.de-field label { color: var(--muted, #6b7280); font-weight: 600; }
.de-field select {
  padding: 6px 8px;
  border: 1px solid var(--border, #eef0f3);
  border-radius: 6px;
  font-size: 14px;
}
.de-advanced { border: 1px solid var(--border, #eef0f3); border-radius: 6px; padding: 8px 10px; }
.de-advanced summary { cursor: pointer; font-weight: 600; color: var(--muted, #6b7280); }
.de-advanced .de-field { margin-top: 8px; }
</style>
