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

      <!-- Stage 2 (design/contrast) + Stage 3 (results: volcano, table, heatmap, QC, boxplot). -->
      <div v-if="dsRef" class="de-selected">
        <p>Selected dataset: <strong>{{ dsRef }}</strong></p>

        <DeDesignPanel :design="design" @change="onConfigChange" />

        <p v-if="running" class="de-running">Running differential expression…</p>
        <p v-if="runErr" class="de-err">{{ runErr }} <button type="button" class="de-retry" @click="onConfigChange(lastCfg)">Retry</button></p>

        <div v-if="rows.length" class="de-results">
          <VolcanoPlot :rows="rows" @select="onSelectProtein" />
          <DeResultsTable :rows="rows" :selected="selectedProtein" @select="onSelectProtein" />
          <DeHeatmap :rows="rows" />
          <ProteinBoxplot :protein="selectedProtein" :row="selectedRow" />
        </div>

        <DeQcPanel :qc="qc" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listDatasets, getDesign, getDefault, getQc, runDe } from '../de.js'
import DePicker from '../components/DePicker.vue'
import DeDesignPanel from '../components/DeDesignPanel.vue'
import VolcanoPlot from '../components/VolcanoPlot.vue'
import DeResultsTable from '../components/DeResultsTable.vue'
import DeHeatmap from '../components/DeHeatmap.vue'
import DeQcPanel from '../components/DeQcPanel.vue'
import ProteinBoxplot from '../components/ProteinBoxplot.vue'

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

// Stage 2/3 state: design + QC load per selected dataset; `rows` holds the
// current contrast's DE result (either the precomputed default or an
// on-demand run), and `selectedProtein` cross-links VolcanoPlot <-> table <->
// ProteinBoxplot.
const design = ref({ factors: [], contrasts: [] })
const qc = ref({ pca: [], norm: {} })
const rows = ref([])
const selectedProtein = ref('')
const running = ref(false)
const runErr = ref('')
const lastCfg = ref(null)

const selectedRow = computed(
  () => rows.value.find((r) => r.protein === selectedProtein.value) || null,
)

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

function onSelectProtein(p) {
  selectedProtein.value = p
}

// Reset stage 2/3 state and (re)load the design + QC for the newly selected
// dataset. Errors are swallowed to defaults — DeDesignPanel/DeQcPanel render
// their own empty states rather than needing a second error banner here.
async function loadDatasetExtras(r) {
  design.value = { factors: [], contrasts: [] }
  qc.value = { pca: [], norm: {} }
  rows.value = []
  selectedProtein.value = ''
  runErr.value = ''
  if (!r) return
  try {
    const [d, q] = await Promise.all([getDesign(r), getQc(r)])
    design.value = d || { factors: [], contrasts: [] }
    qc.value = q || { pca: [], norm: {} }
  } catch (e) {
    design.value = { factors: [], contrasts: [] }
    qc.value = { pca: [], norm: {} }
  }
}
watch(dsRef, loadDatasetExtras)

// The one precomputed contrast result (Task 5's default build) — anything
// else (a different method/normalization/level) needs an on-demand run.
function isDefaultConfig(cfg) {
  return cfg.method === 'limma' && cfg.normalization === 'median' && cfg.level === 'protein'
}

async function onConfigChange(cfg) {
  if (!dsRef.value || !cfg || !cfg.contrast) return
  lastCfg.value = cfg
  const contrastId = (cfg.contrast && cfg.contrast.id) || cfg.contrast
  contrast.value = contrastId || ''
  method.value = cfg.method || ''
  norm.value = cfg.normalization || ''
  level.value = cfg.level || ''

  running.value = true
  runErr.value = ''
  try {
    const res = isDefaultConfig(cfg)
      ? await getDefault(dsRef.value, contrastId)
      : await runDe(dsRef.value, {
        contrast: contrastId, method: cfg.method, normalization: cfg.normalization, level: cfg.level,
      })
    rows.value = (res && res.rows) || []
  } catch (e) {
    rows.value = []
    runErr.value = 'Could not run differential expression.'
  } finally {
    running.value = false
  }
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
.de-running { color: var(--muted, #6b7280); padding: 8px 0; }
.de-results { display: flex; flex-direction: column; gap: 20px; margin: 16px 0; }
</style>
