<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="section-header" style="text-align: left; margin-bottom: 16px">
        <h2>Differential Expression</h2>
        <p style="margin: 0; max-width: none">
          Pick a quantms dataset and choose a contrast to view its differential expression
          result across quantified proteins. The analysis method, normalization and pipeline
          are chosen per dataset by an automated quality check — see the rationale below.
        </p>
      </div>

      <p v-if="loadErr" class="de-err">{{ loadErr }} <button type="button" class="de-retry" @click="load">Retry</button></p>

      <!-- Stage 1: pick a dataset -->
      <DePicker :datasets="datasets" :loading="loading" @select="onSelect" />

      <!-- Stage 2 (design/contrast) + Stage 3 (results: volcano, table, heatmap, QC, boxplot). -->
      <div v-if="dsRef" class="de-selected">
        <p>Selected dataset: <strong>{{ dsRef }}</strong></p>

        <DeDesignPanel
          :design="design"
          :initial-contrast="contrast"
          @change="onConfigChange"
        />

        <p class="de-note">
          The method, normalization and pipeline shown are fixed per dataset (see the
          analysis rationale below). To try a different algorithm, download the quantms
          output from<template v-if="datasetPageTo"> its
          <router-link :to="datasetPageTo">{{ accession }} dataset page</router-link></template>
          and run your own analysis.
        </p>

        <p v-if="running" class="de-running">Loading differential expression result…</p>
        <p v-if="runErr" class="de-err">{{ runErr }} <button type="button" class="de-retry" @click="onConfigChange(lastCfg)">Retry</button></p>

        <div v-if="rows.length" class="de-results">
          <VolcanoPlot :rows="rows" @select="onSelectProtein" />
          <DeResultsTable :rows="rows" :selected="selectedProtein" @select="onSelectProtein" />
          <DeHeatmap :rows="rows" />
          <ProteinBoxplot :protein="selectedProtein" :row="selectedRow" />
        </div>

        <DeQcPanel :qc="qc" :contrast="contrast" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listDatasets, getDesign, getDefault, getQc } from '../de.js'
import DePicker from '../components/DePicker.vue'
import DeDesignPanel from '../components/DeDesignPanel.vue'
import VolcanoPlot from '../components/VolcanoPlot.vue'
import DeResultsTable from '../components/DeResultsTable.vue'
import DeHeatmap from '../components/DeHeatmap.vue'
import DeQcPanel from '../components/DeQcPanel.vue'
import ProteinBoxplot from '../components/ProteinBoxplot.vue'

const route = useRoute()
const router = useRouter()

// State refs mirrored into the URL query string (?ref=&contrast=). Method,
// normalization and level are NOT user-selectable — the published result uses
// the pipeline the QC gate chose per dataset — so they are not URL state.
// Named `dsRef` (not `ref`) so it doesn't shadow the Vue `ref()` import.
const dsRef = ref('')
const contrast = ref('')

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

// The dataset entry that owns the current ref (for accession + display).
const selectedDataset = computed(
  () => datasets.value.find((d) => d.ref === dsRef.value) || null,
)
// Accession for the "download / re-analyse yourself" link. Prefer the dataset
// entry's accession; fall back to the first path segment of the ref (refs are
// `{accession}/{hash}`), so the link works before the list loads.
const accession = computed(
  () => selectedDataset.value?.accession || (dsRef.value ? dsRef.value.split('/')[0] : ''),
)
// Link to this dataset's page in the portal (which carries the quantms output
// to download), NOT to PRIDE — the DE app serves the differential-expression
// collection, so that is the collection name.
const datasetPageTo = computed(
  () => (accession.value ? `/collections/differential-expression/${accession.value}` : ''),
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

// Guards against a stale (superseded) response overwriting newer results: each
// call captures the sequence number in effect when it started, and any
// state-mutating step after an `await` checks it's still the latest before
// touching `rows`/`running` — so a slow request that resolves after a newer
// one was fired can't clobber it or flip `running` back on/off out of order.
let reqSeq = 0

// Contrast is the only thing the user navigates; the analysis itself is the
// published default the QC gate chose, so this always loads the precomputed
// result for the contrast (never an on-demand custom-method run).
async function onConfigChange(cfg) {
  if (!dsRef.value || !cfg || !cfg.contrast) return
  const seq = ++reqSeq
  lastCfg.value = cfg
  const contrastId = (cfg.contrast && cfg.contrast.id) || cfg.contrast
  contrast.value = contrastId || ''

  running.value = true
  runErr.value = ''
  try {
    const res = await getDefault(dsRef.value, contrastId)
    if (seq !== reqSeq) return
    rows.value = (res && res.rows) || []
  } catch (e) {
    if (seq !== reqSeq) return
    rows.value = []
    runErr.value = 'Could not load the differential expression result.'
  } finally {
    if (seq === reqSeq) running.value = false
  }
}

// --- Deep-linkable URL: mirrors ProteomeCompass.vue's URL-as-source-of-truth pattern ---
function currentQuery() {
  const q = {}
  if (dsRef.value) q.ref = dsRef.value
  if (contrast.value) q.contrast = contrast.value
  return q
}
function applyQuery(q) {
  dsRef.value = q.ref ? String(q.ref) : ''
  contrast.value = q.contrast ? String(q.contrast) : ''
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
watch([dsRef, contrast], syncUrl)
// URL -> state (shared link, bookmark, back/forward). This intentionally does
// NOT call `load()` (the `/de/datasets` list) on every query change — that
// list doesn't depend on route state and only needs to be fetched once (see
// onMounted below). Per-ref extras (design/qc) already reload via
// `watch(dsRef, loadDatasetExtras)` when `applyQuery` actually changes
// `dsRef`; a contrast-only change (ref unchanged) instead flows through
// DeDesignPanel re-seeding from its `initial-contrast` prop and re-emitting
// `change`, which reloads results via `onConfigChange`.
watch(() => route.query, (q) => { applyQuery(q) })
onMounted(() => { applyQuery(route.query); load(); syncUrl() })
</script>

<style scoped>
.de-err { color: #b91c1c; padding: 8px 0; }
.de-retry { margin-left: 8px; padding: 3px 12px; border: 1px solid #fca5a5; border-radius: 6px; background: #fff; color: #b91c1c; cursor: pointer; font-size: 13px; }
.de-selected { margin-top: 20px; padding: 16px; border: 1px solid var(--border, #e2e5ea); border-radius: 10px; }
.de-running { color: var(--muted, #6b7280); padding: 8px 0; }
.de-note { color: var(--muted, #6b7280); font-size: 13px; margin: 10px 0 0; line-height: 1.5; }
.de-note a { color: var(--accent, #2563eb); }
.de-results { display: flex; flex-direction: column; gap: 20px; margin: 16px 0; }
</style>
