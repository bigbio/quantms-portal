<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <!-- Breadcrumb -->
      <div class="crumbs">
        <router-link to="/collections" class="crumb">Collections</router-link>
        <span>›</span>
        <router-link :to="`/collections/${collectionName}`" class="crumb">{{ collectionName }}</router-link>
        <span>›</span>
        <span class="crumb-current">{{ accession }}</span>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-block">Loading dataset…</div>

      <!-- Error -->
      <div v-else-if="error" class="notice">
        This dataset is temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="load">Retry</button>
      </div>

      <!-- Not found -->
      <div v-else-if="notFound" class="placeholder-page">
        <span class="placeholder-icon">📊</span>
        <h1>Dataset not found</h1>
        <p>The dataset "{{ accession }}" could not be found.</p>
        <router-link :to="`/collections/${collectionName}`" class="btn btn-primary" style="margin-top: 20px; display: inline-flex">
          ← Back to collection
        </router-link>
      </div>

      <!-- Detail -->
      <template v-else-if="dataset">
        <div class="detail-head">
          <h1 class="detail-acc">{{ dataset.accession }}</h1>
          <span class="tag" :class="collectionTag(dataset.collection)">{{ dataset.collection_title || dataset.collection }}</span>
        </div>
        <DatasetPanel :dataset="dataset" variant="full" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import DatasetPanel from '../components/DatasetPanel.vue'
import { apiGet } from '../api.js'
import { DATASET_SEARCH_BASE } from '../config.js'
import { collectionTag } from '../utils/format.js'

const route = useRoute()
const accession = computed(() => route.params.pxd)
const collectionName = computed(() => route.params.name)

const dataset = ref(null)
const loading = ref(true)
const error = ref(false)
const notFound = ref(false)

async function load() {
  loading.value = true
  error.value = false
  notFound.value = false
  dataset.value = null
  try {
    dataset.value = await apiGet(DATASET_SEARCH_BASE, `/datasets/${accession.value}`)
  } catch (e) {
    if (e && e.status === 404) notFound.value = true
    else error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(accession, load)
</script>

<style scoped>
.crumbs {
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.crumb {
  color: var(--text-muted);
  text-decoration: none;
}
.crumb:hover {
  color: var(--text-secondary);
}
.crumb-current {
  font-family: var(--mono);
  color: var(--indigo);
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.detail-acc {
  font-size: 24px;
  font-weight: 800;
  font-family: var(--mono);
  color: var(--indigo);
}
.loading-block {
  text-align: center;
  padding: 80px 0;
  color: var(--text-muted);
}
.notice {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-secondary);
}
</style>
