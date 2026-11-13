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
import { getCollections, lastCollections } from '../catalog.js'

const collections = ref(lastCollections() || [])
const loading = ref(!collections.value.length)
const error = ref(false)

async function load() {
  loading.value = !collections.value.length
  error.value = false
  try {
    collections.value = await getCollections()
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
