<template>
  <div class="cb">
    <div class="cb-row">
      <label class="cb-pick">
        Colour samples by
        <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
          <option v-for="f in fields" :key="f.key" :value="f.key">{{ f.title }} ({{ f.distinct }})</option>
        </select>
      </label>
      <ul class="cb-legend" @mouseleave="$emit('update:highlight', '')">
        <li v-for="g in groups" :key="g.family || g.items[0].label" class="cb-group">
          <button
            v-if="g.family"
            type="button"
            class="cb-family"
            :class="{ dim: highlight && highlight !== g.family && !g.items.some((l) => l.label === highlight) }"
            :title="`Highlight ${g.family}`"
            @mouseenter="$emit('update:highlight', g.family)"
            @focus="$emit('update:highlight', g.family)"
            @blur="$emit('update:highlight', '')"
          >{{ g.family }}</button>
          <button
            v-for="l in g.items"
            :key="l.label"
            type="button"
            class="cb-key"
            :class="{ dim: highlight && highlight !== l.label && highlight !== g.family }"
            :title="`Highlight ${l.label}`"
            @mouseenter="$emit('update:highlight', l.label)"
            @focus="$emit('update:highlight', l.label)"
            @blur="$emit('update:highlight', '')"
          >
            <i :style="{ background: l.colour }" />{{ l.label }}<span>{{ l.n.toLocaleString() }}</span>
          </button>
        </li>
      </ul>
    </div>
    <p v-if="note" class="cb-note">{{ note }}</p>
  </div>
</template>

<script setup>
// Picks the sample annotation the Explorer charts are coloured by and shows its
// legend, values of one biological group under the group's name; hovering or
// focusing a key highlights that value or group in every chart.
import { computed } from 'vue'

const props = defineProps({
  fields: { type: Array, required: true },
  modelValue: { type: String, required: true },
  // [{ label, colour, n, family? }]
  legend: { type: Array, required: true },
  highlight: { type: String, default: '' },
  // how the colours are chosen, or that they are still being looked up
  note: { type: String, default: '' },
})
defineEmits(['update:modelValue', 'update:highlight'])

// Consecutive entries of one family form a group; entries without one stand alone.
const groups = computed(() => {
  const out = []
  for (const l of props.legend) {
    const last = out[out.length - 1]
    if (l.family && last && last.family === l.family) last.items.push(l)
    else out.push({ family: l.family || '', items: [l] })
  }
  return out
})
</script>

<style scoped>
.cb { margin: 0 0 12px; font-size: 13px; }
.cb-row { display: flex; align-items: flex-start; gap: 8px 16px; flex-wrap: wrap; }
.cb-pick { display: inline-flex; align-items: center; gap: 8px; color: var(--text-secondary); white-space: nowrap; }
.cb-pick select { font: inherit; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface); color: var(--text-primary); }
.cb-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 0; list-style: none; flex: 1; min-width: 0; }
.cb-group { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 2px; }
.cb-key, .cb-family { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border: 1px solid transparent; border-radius: 6px;
  background: none; font: inherit; color: var(--text-primary); cursor: default; transition: opacity 0.15s; }
.cb-family { padding-right: 2px; font-size: 12px; color: var(--text-muted); }
.cb-key:hover, .cb-key:focus-visible, .cb-family:hover, .cb-family:focus-visible { border-color: var(--border); outline: none; }
.cb-key.dim, .cb-family.dim { opacity: 0.4; }
.cb-key i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.cb-key span { color: var(--text-muted); font-family: var(--mono); font-size: 12px; }
.cb-note { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }
@media (prefers-reduced-motion: reduce) { .cb-key, .cb-family { transition: none; } }
</style>
