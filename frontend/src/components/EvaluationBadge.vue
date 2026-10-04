<template>
  <div v-if="record" class="eval-badge">
    <span v-if="record.verdict === 'ERROR'" class="eval-chip chip-FAIL eval-verdict">Evaluation ERROR</span>
    <span v-for="d in dims" :key="d.key" class="eval-chip" :class="`chip-${d.status}`">{{ d.label }} {{ d.status }}</span>
    <span v-if="record.override" class="eval-override">Published with override: {{ record.override.override_reason }}</span>
    <details class="eval-details">
      <summary>Quality checks ({{ checks.length }}) · evaluator {{ record.evaluator_version }}</summary>
      <table>
        <tr v-for="c in checks" :key="c.id" :class="`row-${c.status}`">
          <td><code>{{ c.id }}</code></td><td>{{ c.status }}</td>
          <td>{{ fmt(c.value) }}</td><td>{{ c.threshold || '' }}</td><td>{{ c.reason }}</td>
        </tr>
      </table>
    </details>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ record: { type: Object, default: null } })
const LABELS = { ms: 'MS', biology: 'Biology', metadata: 'Metadata' }
const dims = computed(() => Object.keys(LABELS).map((key) => ({
  key, label: LABELS[key], status: (props.record?.dimensions || {})[key] || 'NA' })))
const checks = computed(() => (Array.isArray(props.record?.checks) ? props.record.checks : []))
const fmt = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))
</script>

<style scoped>
.eval-badge { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; }
.eval-chip { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); }
.chip-PASS { color: var(--qual-high); border-color: var(--qual-high); }
.chip-WARN { color: var(--qual-medium); border-color: var(--qual-medium); }
.chip-FAIL { color: var(--qual-low); border-color: var(--qual-low); }
.chip-NA { color: var(--text-secondary); }
.eval-override { font-size: 12px; color: var(--qual-medium); }
.eval-details { width: 100%; font-size: 13px; }
.eval-details td { padding: 2px 8px; vertical-align: top; }
</style>
