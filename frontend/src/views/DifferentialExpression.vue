<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="section-header" style="text-align: left; margin-bottom: 16px">
        <h2>Differential Expression</h2>
        <p style="margin: 0; max-width: none">
          Pick a quantms dataset, choose a contrast, and run a differential expression
          analysis across quantified proteins.
        </p>
      </div>

      <p v-if="loadErr" class="de-err">{{ loadErr }} <button type="button" class="de-retry" @click="load">Retry</button></p>

      <!-- Stage 1: pick a dataset -->
      <DePicker :datasets="datasets" :loading="loading" @select="onSelect" />

      <!-- Stage 2 (design/contrast picker) and Stage 3 (results) land in later tasks. -->
      <div v-if="dsRef" class="de-selected">
        <p>Selected dataset: <strong>{{ dsRef }}</strong></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listDatasets } from '../de.js'
import DePicker from '../components/DePicker.vue'

const route = useRoute()
const router = useRouter()

// State refs mirrored into the URL query string (?ref=&contrast=&method=&norm=&level=).
// Named `dsRef` (not `ref`) so it doesn't shadow the Vue `ref()` import.
const dsRef = ref('')
const contrast = ref('')
const method = ref('')
const norm = ref('')
const level = ref('')

const datasets = ref([])
const loading = ref(false)
const loadErr = ref('')

async function load() {
  loadErr.value = ''
  loading.value = true
  try {
    const res = await listDatasets()
    datasets.value = (res && res.datasets) || []
  } catch (e) {
    datasets.value = []
    loadErr.value = 'Could not load datasets.'
  } finally {
    loading.value = false
  }
}

function onSelect(r) {
  dsRef.value = r
}

// --- Deep-linkable URL: mirrors ProteomeCompass.vue's URL-as-source-of-truth pattern ---
function currentQuery() {
  const q = {}
  if (dsRef.value) q.ref = dsRef.value
  if (contrast.value) q.contrast = contrast.value
  if (method.value) q.method = method.value
  if (norm.value) q.norm = norm.value
  if (level.value) q.level = level.value
  return q
}
function applyQuery(q) {
  dsRef.value = q.ref ? String(q.ref) : ''
  contrast.value = q.contrast ? String(q.contrast) : ''
  method.value = q.method ? String(q.method) : ''
  norm.value = q.norm ? String(q.norm) : ''
  level.value = q.level ? String(q.level) : ''
}
// Shallow equality over query objects (all values compared as strings, since
// route.query is always string-valued).
function sameQuery(a, b) {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  return ak.every((k) => String(a[k]) === String(b[k]))
}
// Reflect state into the URL. Skip the router.replace when the computed query
// already matches route.query — Vue watchers flush async, so a re-entrancy flag
// would be reset before the URL-sync ran; comparing the query is what actually
// prevents the redundant navigation + double-load.
function syncUrl() {
  const q = currentQuery()
  if (sameQuery(q, route.query)) return
  router.replace({ query: q }).catch(() => {})
}
// state -> URL
watch([dsRef, contrast, method, norm, level], syncUrl)
// URL -> state + data (shared link, bookmark, back/forward)
watch(() => route.query, (q) => { applyQuery(q); load() })
onMounted(() => { applyQuery(route.query); load(); syncUrl() })
</script>

<style scoped>
.de-err { color: #b91c1c; padding: 8px 0; }
.de-retry { margin-left: 8px; padding: 3px 12px; border: 1px solid #fca5a5; border-radius: 6px; background: #fff; color: #b91c1c; cursor: pointer; font-size: 13px; }
.de-selected { margin-top: 20px; padding: 16px; border: 1px solid var(--border, #e2e5ea); border-radius: 10px; }
</style>
