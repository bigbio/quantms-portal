<template>
  <table class="cc-table">
    <thead>
      <tr>
        <th v-for="c in columns" :key="c.key" scope="col" :class="c.class">{{ c.label }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in rows" :key="rowKeyFor(row, i)">
        <td v-for="c in columns" :key="c.key" :class="c.class">
          <!-- A column may be rendered by a named slot (keyed on its `key`),
               otherwise falls back to the `render(row)` function or the raw field. -->
          <slot :name="c.key" :row="row">{{ cellText(c, row) }}</slot>
        </td>
      </tr>
      <tr v-if="!rows.length">
        <td :colspan="columns.length" class="cc-muted">{{ emptyMessage }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
const props = defineProps({
  // Each column: { key, label, render?(row) -> text, class? }.
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  emptyMessage: { type: String, default: 'No matches.' },
  // Field on each row used as the :key for its <tr>.
  rowKey: { type: String, default: 'uniprot_acc' },
})

function rowKeyFor(row, i) {
  const k = row && row[props.rowKey]
  return k == null ? i : k
}
function cellText(c, row) {
  if (typeof c.render === 'function') return c.render(row)
  const v = row ? row[c.key] : undefined
  return v == null ? '' : v
}
</script>

<style scoped>
.cc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.cc-table th, .cc-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border, #eef0f3); }
.cc-table th { color: var(--muted, #6b7280); font-weight: 600; }
.cc-muted { color: #9ca3af; }
.num { text-align: right; font-variant-numeric: tabular-nums; }

@media (max-width: 768px) {
  .cc-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .cc-table th, .cc-table td { white-space: nowrap; }
}
</style>
