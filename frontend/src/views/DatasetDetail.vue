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
        <button class="page-btn" style="margin-left: 12px" @click="load()">Retry</button>
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
        <EvaluationBadge :record="evaluation" />
        <div v-if="versions.length > 1" class="versions">
          <span class="versions-label">{{ versions.length }} versions of {{ dataset.accession }}:</span>
          <router-link
            v-for="v in versions"
            :key="v.dataset_ref"
            :to="datasetPath({ collection: v.collection || collectionName, dataset_ref: v.dataset_ref })"
            class="version-link"
            :class="{ current: v.dataset_ref === dataset.dataset_ref }"
          >{{ v.organism || v.dataset_ref }} <EvaluationChip :dataset-ref="v.dataset_ref" /></router-link>
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
import EvaluationBadge from '../components/EvaluationBadge.vue'
import EvaluationChip from '../components/EvaluationChip.vue'
import { datasetPath, fetchEvaluation } from '../utils/evaluation.js'
import { apiGet } from '../api.js'
import { DATASET_SEARCH_BASE } from '../config.js'
import { collectionTag } from '../utils/format.js'
import { createRequestGuard } from '../utils/requestGuard.js'

const route = useRoute()
const accession = computed(() => route.params.pxd)
const collectionName = computed(() => route.params.name)
const refHash = computed(() => route.params.hash || null)
const versions = computed(() => (Array.isArray(dataset.value?.versions) ? dataset.value.versions : []))

const dataset = ref(null)
const loading = ref(true)
const error = ref(false)
const notFound = ref(false)
const evaluation = ref(null)

const guard = createRequestGuard()

// Best-effort: a missing/failed record (404 until evaluated) just means no badge.
async function loadEvaluation(data, isCurrent) {
  const rec = await fetchEvaluation(data?.dataset_ref)
  if (isCurrent()) evaluation.value = rec
}

async function load() {
  const isCurrent = guard.next()
  loading.value = true
  error.value = false
  notFound.value = false
  dataset.value = null
  evaluation.value = null
  try {
    const path = refHash.value
      ? `/datasets/${encodeURIComponent(accession.value)}/${encodeURIComponent(refHash.value)}`
      : `/datasets/${encodeURIComponent(accession.value)}`
    const data = await apiGet(DATASET_SEARCH_BASE, path)
    if (isCurrent()) {
      dataset.value = data
      loadEvaluation(data, isCurrent)
    }
  } catch (e) {
    if (!isCurrent()) return
    if (e && e.status === 404) notFound.value = true
    else error.value = true
  } finally {
    if (isCurrent()) loading.value = false
  }
}

onMounted(load)
watch([accession, refHash], load)
</script>

<style scoped>
.versions { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; margin: 4px 0 16px; font-size: 13px; }
.versions-label { color: var(--text-muted); }
.version-link { display: inline-flex; gap: 6px; align-items: center; padding: 2px 8px; border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-secondary); text-decoration: none; }
.version-link.current { border-color: var(--indigo); color: var(--indigo); }
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
