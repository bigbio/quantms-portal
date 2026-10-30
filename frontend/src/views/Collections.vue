<template>
  <section class="page-head">
    <div class="container">
      <h1>Collections</h1>
      <p>Curated groups of quantms datasets, each with specialized indexes and services.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div v-if="error" class="notice">
        Collections are temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="load">Retry</button>
      </div>

      <div v-else-if="!loading && collections.length === 0" class="notice">No collections found.</div>

      <CollectionsTable v-else :collections="collections" :loading="loading" />
      <p class="table-note">
        Per-collection peptide and protein counts from the search index are on the
        <router-link to="/statistics">Statistics</router-link> page.
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import CollectionsTable from '../components/CollectionsTable.vue'
import { apiGet } from '../api.js'
import { DATASET_SEARCH_BASE } from '../config.js'

const collections = ref([])
const loading = ref(true)
const error = ref(false)

async function load() {
  loading.value = true
  error.value = false
  try {
    const data = await apiGet(DATASET_SEARCH_BASE, '/collections')
    collections.value = data.collections || []
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.notice {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-secondary);
}
</style>
