<template>
  <div class="table-scroll">
    <table class="data-table collections-table" :aria-busy="loading">
      <thead>
        <tr>
          <th scope="col">Collection</th>
          <th scope="col">Scope</th>
          <th scope="col">Type</th>
          <th scope="col" class="num">Datasets</th>
        </tr>
      </thead>
      <!-- While loading, placeholder rows hold the table's usual size. -->
      <tbody v-if="loading" aria-hidden="true">
        <tr v-for="i in 3" :key="i">
          <th scope="row"><span class="skel" style="width: 11em" /></th>
          <td><span class="skel" style="width: 95%" /><br /><span class="skel" style="width: 60%" /></td>
          <td><span class="skel" style="width: 6em" /></td>
          <td class="num"><span class="skel" style="width: 2ch" /></td>
        </tr>
      </tbody>
      <tbody v-else class="data-in">
        <tr v-for="c in collections" :key="c.name">
          <th scope="row">
            <router-link :to="`/collections/${encodeURIComponent(c.name)}`">{{ c.title || c.name }}</router-link>
          </th>
          <td>{{ c.description }}</td>
          <td class="type">{{ c.type }}</td>
          <td class="num">{{ c.dataset_count ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  // Collections as returned by the dataset-search /collections endpoint.
  collections: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})
</script>

<style scoped>
.collections-table tbody th {
  font-weight: 600;
  white-space: nowrap;
}
.collections-table tbody th a {
  color: var(--brand);
}
.collections-table td:nth-child(2) {
  color: var(--text-secondary);
  max-width: 70ch;
}
.collections-table .skel {
  color: var(--text-muted);
}
.collections-table .type::first-letter {
  text-transform: uppercase;
}
</style>
