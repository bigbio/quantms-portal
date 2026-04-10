<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">

      <!-- Page header -->
      <div style="margin-bottom: 32px;">
        <h1 style="font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
          Baseline Protein Expression
        </h1>
        <p style="font-size: 15px; color: var(--text-secondary); max-width: 640px;">
          Search protein expression across human tissues and cell lines using iBAQ log2 intensities
          from reanalysed public proteomics datasets.
        </p>
      </div>

      <!-- Search bar -->
      <div class="search-card">
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <div style="position: relative; flex: 1; min-width: 220px;">
            <select v-model="sourceType" class="source-select">
              <option value="tissue">Tissue (Human)</option>
              <option value="cell">Cell Line (Human)</option>
            </select>
          </div>
          <div style="position: relative; flex: 2; min-width: 220px;">
            <input
              v-model="query"
              class="search-input"
              placeholder="Protein accession (e.g. P50851, Q96HS1)"
              @keyup.enter="search"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <button class="btn btn-primary" style="padding: 10px 24px; font-size: 14px;" @click="search" :disabled="searching">
            {{ searching ? 'Searching…' : 'Search' }}
          </button>
        </div>
        <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
          Examples:
          <span v-for="ex in examples" :key="ex" class="example-link" @click="useExample(ex)">{{ ex }}</span>
        </div>
      </div>

      <!-- Loading data indicator -->
      <div v-if="loadingData" style="text-align: center; padding: 48px 0; color: var(--text-muted); font-size: 14px;">
        Loading expression database… ({{ sourceType === 'tissue' ? '~3 MB' : '~1 MB' }})
      </div>

      <!-- Error -->
      <div v-else-if="errorMsg" style="text-align: center; padding: 48px 0;">
        <div style="color: #f87171; font-size: 15px; margin-bottom: 8px;">{{ errorMsg }}</div>
        <div style="color: var(--text-muted); font-size: 13px;">Try another accession or gene name.</div>
      </div>

      <!-- Results -->
      <div v-else-if="result" class="results-card">
        <!-- Result header -->
        <div style="display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;">
          <h2 style="font-size: 20px; font-weight: 700; font-family: var(--mono); color: var(--indigo);">
            {{ result.name }}
          </h2>
          <span v-if="result.gene_name" style="font-size: 15px; color: var(--text-secondary); font-weight: 600;">
            {{ result.gene_name }}
          </span>
          <span class="tag tag-indigo" style="font-size: 12px;">iBAQ log₂</span>
          <span class="tag" style="font-size: 12px; background: var(--surface-2); color: var(--text-secondary);">
            {{ sourceLabel }}
          </span>
        </div>

        <!-- Summary stats -->
        <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px;">
          <div class="summary-stat">
            <div class="stat-value" style="font-size: 18px;">{{ tissueRows.length }}</div>
            <div class="stat-label">{{ sourceType === 'tissue' ? 'Tissues' : 'Cell Lines' }}</div>
          </div>
          <div class="summary-stat">
            <div class="stat-value" style="font-size: 18px;">{{ totalSamples }}</div>
            <div class="stat-label">Total Samples</div>
          </div>
          <div class="summary-stat">
            <div class="stat-value" style="font-size: 18px;">{{ overallMedian }}</div>
            <div class="stat-label">Overall Median</div>
          </div>
          <div class="summary-stat">
            <div class="stat-value" style="font-size: 18px;">{{ expressionRange }}</div>
            <div class="stat-label">Range (log₂)</div>
          </div>
        </div>

        <!-- Expression table -->
        <div class="expr-table-wrap">
          <table class="expr-table">
            <thead>
              <tr>
                <th>{{ sourceType === 'tissue' ? 'Tissue' : 'Cell Line' }}</th>
                <th style="text-align: center;">Samples</th>
                <th style="text-align: right;">Min</th>
                <th style="text-align: right;">Q1</th>
                <th style="text-align: right;">Median</th>
                <th style="text-align: right;">Q3</th>
                <th style="text-align: right;">Max</th>
                <th style="min-width: 140px;">Expression</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in tissueRows" :key="row.tissue">
                <td class="tissue-name">{{ row.tissue }}</td>
                <td style="text-align: center; color: var(--text-muted); font-size: 13px;">{{ row.count }}</td>
                <td style="text-align: right; font-size: 13px; color: var(--text-muted);">{{ row.min }}</td>
                <td style="text-align: right; font-size: 13px; color: var(--text-secondary);">{{ row.q1 }}</td>
                <td style="text-align: right; font-size: 13px; font-weight: 600; color: var(--text-primary);">{{ row.median }}</td>
                <td style="text-align: right; font-size: 13px; color: var(--text-secondary);">{{ row.q3 }}</td>
                <td style="text-align: right; font-size: 13px; color: var(--text-muted);">{{ row.max }}</td>
                <td>
                  <div class="bar-track">
                    <div class="bar-iqr" :style="iqrStyle(row)"></div>
                    <div class="bar-median" :style="medianStyle(row)"></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 14px; font-size: 12px; color: var(--text-muted);">
          Bar shows IQR (Q1–Q3) range. Tick marks the median. All values are iBAQ log₂ intensities.
          Sorted by median expression (descending).
        </div>
      </div>

      <!-- Empty state -->
      <div v-else style="text-align: center; padding: 64px 0; color: var(--text-muted);">
        <div style="font-size: 40px; margin-bottom: 16px;">🔬</div>
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">Search for a protein</div>
        <div style="font-size: 13px;">Enter a UniProt accession or gene name above to see tissue expression data.</div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// ── State ─────────────────────────────────────────────────────────────────────
const query = ref('')
const sourceType = ref('tissue')
const loadingData = ref(false)
const searching = ref(false)
const errorMsg = ref('')
const result = ref(null)

// Cached databases (loaded once per source type)
const tissueDb = ref(null)
const cellDb = ref(null)

const examples = ['P50851', 'Q96HS1', 'Q14114', 'P04637']

const sourceLabel = computed(() =>
  sourceType.value === 'tissue' ? 'Human Tissues' : 'Human Cell Lines'
)

// ── Load gzip JSON ─────────────────────────────────────────────────────────────
// The .gz file may be transparently decompressed by the server/browser
// (Content-Encoding: gzip) or served as raw bytes. Handle both cases.
async function loadGzipJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)

  // Clone response so we can retry if first approach fails
  const clone = response.clone()

  // Try 1: server already decompressed it (Content-Encoding: gzip) — just parse
  try {
    return await response.json()
  } catch {
    // Try 2: raw gzip bytes — decompress manually
    const ds = new DecompressionStream('gzip')
    const stream = clone.body.pipeThrough(ds)
    const text = await new Response(stream).text()
    return JSON.parse(text)
  }
}

// Build index: { name -> entry, gene_name -> entry } from array
function buildIndex(entries) {
  const idx = {}
  for (const entry of entries) {
    if (entry.name) idx[entry.name.toUpperCase()] = entry
    if (entry.gene_name) idx[entry.gene_name.toUpperCase()] = entry
  }
  return idx
}

async function getDb() {
  if (sourceType.value === 'tissue') {
    if (!tissueDb.value) {
      loadingData.value = true
      try {
        const base = import.meta.env.BASE_URL
        const raw = await loadGzipJson(`${base}data/tissueJson.json.gz`)
        tissueDb.value = buildIndex(Array.isArray(raw) ? raw : Object.values(raw))
      } finally {
        loadingData.value = false
      }
    }
    return tissueDb.value
  } else {
    if (!cellDb.value) {
      loadingData.value = true
      try {
        const base = import.meta.env.BASE_URL
        const raw = await loadGzipJson(`${base}data/cellJson.json.gz`)
        cellDb.value = buildIndex(Array.isArray(raw) ? raw : Object.values(raw))
      } finally {
        loadingData.value = false
      }
    }
    return cellDb.value
  }
}

// ── Box plot stats ─────────────────────────────────────────────────────────────
function boxStats(values) {
  if (!values || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  return {
    min: +sorted[0].toFixed(2),
    q1: +sorted[Math.floor(n * 0.25)].toFixed(2),
    median: +sorted[Math.floor(n * 0.5)].toFixed(2),
    q3: +sorted[Math.floor(n * 0.75)].toFixed(2),
    max: +sorted[n - 1].toFixed(2),
    count: n,
  }
}

// ── Computed results ───────────────────────────────────────────────────────────
const tissueRows = computed(() => {
  if (!result.value) return []
  const { tags, data } = result.value
  const rows = []
  for (let i = 0; i < tags.length; i++) {
    const vals = data[i]
    if (!vals || vals.length === 0) continue
    const stats = boxStats(vals)
    if (!stats) continue
    rows.push({ tissue: tags[i], ...stats })
  }
  return rows.sort((a, b) => b.median - a.median)
})

const totalSamples = computed(() => tissueRows.value.reduce((s, r) => s + r.count, 0))

const overallMedian = computed(() => {
  const meds = tissueRows.value.map(r => r.median)
  if (!meds.length) return '—'
  const sorted = [...meds].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)].toFixed(2)
})

const expressionRange = computed(() => {
  const rows = tissueRows.value
  if (!rows.length) return '—'
  const mn = Math.min(...rows.map(r => r.min))
  const mx = Math.max(...rows.map(r => r.max))
  return `${mn.toFixed(1)} – ${mx.toFixed(1)}`
})

// Global min/max for bar scaling
const globalMin = computed(() => Math.min(...tissueRows.value.map(r => r.min)))
const globalMax = computed(() => Math.max(...tissueRows.value.map(r => r.max)))

function pct(val) {
  const mn = globalMin.value
  const mx = globalMax.value
  if (mx === mn) return 0
  return ((val - mn) / (mx - mn)) * 100
}

function iqrStyle(row) {
  const left = pct(row.q1)
  const width = pct(row.q3) - pct(row.q1)
  return { left: left + '%', width: width + '%' }
}

function medianStyle(row) {
  const pos = pct(row.median)
  return { left: `calc(${pos}% - 1px)` }
}

// ── Search ─────────────────────────────────────────────────────────────────────
async function search() {
  const q = query.value.trim().toUpperCase()
  if (!q) return

  errorMsg.value = ''
  result.value = null
  searching.value = true

  try {
    const db = await getDb()
    const entry = db[q]
    if (!entry) {
      errorMsg.value = `No expression data found for "${query.value.trim()}".`
    } else {
      result.value = entry
    }
  } catch (e) {
    errorMsg.value = `Failed to load expression data: ${e.message}`
  } finally {
    searching.value = false
  }
}

function useExample(ex) {
  query.value = ex
  search()
}
</script>

<style scoped>
.search-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 22px 24px;
  margin-bottom: 32px;
}

.source-select {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2, var(--surface));
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font);
  cursor: pointer;
  appearance: auto;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2, var(--surface));
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--mono);
  box-sizing: border-box;
}

.search-input:focus,
.source-select:focus {
  outline: none;
  border-color: var(--indigo);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.example-link {
  display: inline-block;
  margin-left: 8px;
  color: var(--indigo);
  cursor: pointer;
  font-family: var(--mono);
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.example-link:hover {
  opacity: 0.75;
}

.results-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px;
}

.summary-stat {
  text-align: center;
  padding: 12px 20px;
  background: var(--surface-2, rgba(99,102,241,0.06));
  border-radius: 10px;
  border: 1px solid var(--border);
}

.expr-table-wrap {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.expr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.expr-table thead tr {
  background: var(--surface-2, rgba(99,102,241,0.06));
  border-bottom: 1px solid var(--border);
}

.expr-table th {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.expr-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}

.expr-table tbody tr:last-child {
  border-bottom: none;
}

.expr-table tbody tr:hover {
  background: rgba(99, 102, 241, 0.04);
}

.expr-table td {
  padding: 9px 14px;
  vertical-align: middle;
}

.tissue-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
  white-space: nowrap;
  text-transform: capitalize;
}

/* Bar visualisation */
.bar-track {
  position: relative;
  height: 10px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 5px;
  overflow: visible;
  min-width: 120px;
}

.bar-iqr {
  position: absolute;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  border-radius: 5px;
  opacity: 0.75;
}

.bar-median {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 16px;
  background: #e2e8f0;
  border-radius: 1px;
}
</style>
