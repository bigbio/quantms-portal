<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="section-header">
        <h2>All Collections</h2>
        <p>Curated groups of quantms datasets, each with specialized indexes and services.</p>
      </div>

      <!-- Loading skeletons -->
      <div v-if="loading" class="collection-grid">
        <div v-for="n in 4" :key="n" class="skeleton-card"></div>
      </div>

      <!-- Error / retry -->
      <div v-else-if="error" class="notice">
        Collections are temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="load">Retry</button>
      </div>

      <!-- Empty -->
      <div v-else-if="collections.length === 0" class="notice">No collections found.</div>

      <!-- Cards -->
      <div v-else class="collection-grid">
        <CollectionCard
          v-for="col in collections"
          :key="col.name"
          :collection="col"
          @select="goToCollection"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CollectionCard from '../components/CollectionCard.vue'
import { apiGet } from '../api.js'
import { DATASET_SEARCH_BASE } from '../config.js'

const router = useRouter()
const collections = ref([])
const loading = ref(true)
const error = ref(false)

function goToCollection(name) {
  router.push(`/collections/${name}`)
}

async function load() {
  loading.value = true
  error.value = false
  try {
    const data = await apiGet(DATASET_SEARCH_BASE, '/collections')
    collections.value = (data.collections || []).map((c) => ({
      name: c.name,
      title: c.title || c.name,
      description: c.description || '',
      dataset_count: c.dataset_count || 0,
      organisms: c.organisms || [],
      stats: {
        total_peptides: c.total_peptides || 0,
        total_proteins: c.total_proteins || 0,
      },
    }))
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.skeleton-card {
  height: 220px;
  border-radius: 12px;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.notice {
  padding: 20px 22px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-secondary);
}
</style>
