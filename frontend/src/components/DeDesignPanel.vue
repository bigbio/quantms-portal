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
})
const emit = defineEmits(['change'])

const methods = ['limma', 'deqms', 'rots', 'limrots', 'proda']
const normalizations = ['median', 'quantile', 'none', 'loess', 'rlr']
const levels = ['protein', 'feature']

const factors = computed(() => props.design?.factors || [])

const selectedFactor = ref(factors.value[0]?.name || '')
const availableContrasts = computed(() => contrastsForFactor(props.design, selectedFactor.value))
const selectedContrastId = ref(availableContrasts.value[0]?.id || '')

const method = ref('limma')
const normalization = ref('median')
const level = ref('protein')

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

watch(
  () => props.design,
  () => {
    if (!factors.value.find((f) => f.name === selectedFactor.value)) {
      selectedFactor.value = factors.value[0]?.name || ''
    }
    if (!availableContrasts.value.find((c) => c.id === selectedContrastId.value)) {
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
