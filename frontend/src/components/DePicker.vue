<template>
  <div>
    <p v-if="loading" class="de-loading">Loading datasets…</p>
    <div v-else class="de-picker-wrap">
      <table class="de-table">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Accession</th>
            <th scope="col">Organism</th>
            <th scope="col" class="num">Samples</th>
            <th scope="col">Factors</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="d in datasets"
            :key="d.ref"
            class="de-row"
            role="button"
            tabindex="0"
            :aria-label="`Select dataset ${d.accession}`"
            @click="select(d)"
            @keyup.enter="select(d)"
          >
            <td>{{ d.title || d.accession }}</td>
            <td>{{ d.accession }}</td>
            <td>{{ d.organism || '—' }}</td>
            <td class="num">{{ d.n_samples ?? '—' }}</td>
            <td>{{ (d.factors || []).join(', ') || '—' }}</td>
          </tr>
          <tr v-if="!datasets.length">
            <td colspan="5" class="de-muted">No datasets available.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
defineProps({
  datasets: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

function select(d) {
  emit('select', d.ref)
}
</script>

<style scoped>
.de-loading { color: var(--muted, #6b7280); padding: 8px 0; }
.de-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.de-table th, .de-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border, #eef0f3); }
.de-table th { color: var(--muted, #6b7280); font-weight: 600; }
.de-muted { color: #9ca3af; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.de-row { cursor: pointer; }
.de-row:hover { background: #f8fafc; }
.de-row:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; }

@media (max-width: 768px) {
  .de-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .de-table th, .de-table td { white-space: nowrap; }
}
</style>
