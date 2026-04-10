<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">

      <!-- Page header -->
      <div style="margin-bottom: 32px;">
        <h1 style="font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
          Baseline Protein Expression
        </h1>
        <p style="font-size: 15px; color: var(--text-secondary); max-width: 640px;">
          Compare protein expression across human tissues and cell lines using iBAQ log2 intensities.
          Add up to 5 proteins to compare side by side.
        </p>
      </div>

      <!-- Search bar -->
      <div class="search-card">
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <div style="position: relative; flex: 1; min-width: 180px;">
            <select v-model="sourceType" class="source-select" @change="clearResults">
              <option value="tissue">Tissue (Human)</option>
              <option value="cell">Cell Line (Human)</option>
            </select>
          </div>
          <div style="position: relative; flex: 2; min-width: 220px;">
            <input
              v-model="query"
              class="search-input"
              :placeholder="proteins.length ? 'Add another protein…' : 'Protein accession (e.g. P50851)'"
              @keyup.enter="addProtein"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <button class="btn btn-primary" style="padding: 10px 24px; font-size: 14px;" @click="addProtein" :disabled="searching || proteins.length >= 5">
            {{ searching ? 'Loading…' : 'Add' }}
          </button>
        </div>

        <!-- Protein tags -->
        <div v-if="proteins.length" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
          <span v-for="(p, i) in proteins" :key="p.name" class="protein-tag" :style="{ background: tagColors[i], color: '#fff' }">
            {{ p.name }}
            <span v-if="p.gene_name" style="opacity: 0.8; margin-left: 2px; font-weight: 400;">({{ p.gene_name }})</span>
            <button class="tag-close" @click="removeProtein(i)">&times;</button>
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 13px; color: var(--text-muted);">
            Examples:
            <span v-for="ex in examples" :key="ex" class="example-link" @click="useExample(ex)">{{ ex }}</span>
          </div>
          <button v-if="proteins.length" class="btn-text" @click="clearResults" style="font-size: 13px; color: var(--text-muted); cursor: pointer; background: none; border: none; text-decoration: underline;">
            Clear all
          </button>
        </div>
      </div>

      <!-- Loading data indicator -->
      <div v-if="loadingData" style="text-align: center; padding: 48px 0; color: var(--text-muted); font-size: 14px;">
        Loading expression database… ({{ sourceType === 'tissue' ? '~4 MB' : '~20 MB' }})
      </div>

      <!-- Error -->
      <div v-else-if="errorMsg" style="text-align: center; padding: 24px 0;">
        <div style="color: #f87171; font-size: 15px; margin-bottom: 8px;">{{ errorMsg }}</div>
        <div style="color: var(--text-muted); font-size: 13px;">Try another accession or gene name.</div>
      </div>

      <!-- Comparison table -->
      <div v-if="proteins.length && !loadingData" class="results-card">
        <div style="display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;">
          <h2 style="font-size: 20px; font-weight: 700; color: var(--text-primary);">
            {{ proteins.length === 1 ? proteins[0].name : 'Protein Comparison' }}
          </h2>
          <span v-if="proteins.length === 1 && proteins[0].gene_name" style="font-size: 15px; color: var(--text-secondary); font-weight: 600;">
            {{ proteins[0].gene_name }}
          </span>
          <span class="tag tag-indigo" style="font-size: 12px;">iBAQ log₂</span>
          <span class="tag" style="font-size: 12px; background: rgba(99,102,241,0.08); color: var(--text-secondary);">
            {{ sourceLabel }}
          </span>
        </div>

        <!-- Summary stats -->
        <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px;">
          <div class="summary-stat">
            <div class="stat-value" style="font-size: 18px;">{{ proteins.length }}</div>
            <div class="stat-label">Proteins</div>
          </div>
          <div class="summary-stat">
            <div class="stat-value" style="font-size: 18px;">{{ allTissues.length }}</div>
            <div class="stat-label">{{ sourceType === 'tissue' ? 'Tissues' : 'Cell Lines' }}</div>
          </div>
          <div class="summary-stat">
            <div class="stat-value" style="font-size: 18px;">{{ expressionRange }}</div>
            <div class="stat-label">Range (log₂)</div>
          </div>
        </div>

        <!-- Comparison table -->
        <div class="expr-table-wrap">
          <table class="expr-table">
            <thead>
              <tr>
                <th>{{ sourceType === 'tissue' ? 'Tissue' : 'Cell Line' }}</th>
                <th v-for="(p, i) in proteins" :key="p.name" style="text-align: center; min-width: 100px;">
                  <span :style="{ color: tagColors[i], fontWeight: 700 }">{{ p.name }}</span>
                  <div v-if="p.gene_name" style="font-size: 10px; font-weight: 400; color: var(--text-muted);">{{ p.gene_name }}</div>
                </th>
                <th v-if="proteins.length > 1" style="min-width: 160px;">Comparison</th>
                <th v-else style="min-width: 140px;">Expression</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tissue in allTissues" :key="tissue">
                <td class="tissue-name">{{ tissue }}</td>
                <td v-for="(p, i) in proteins" :key="p.name + tissue" style="text-align: center; font-size: 13px;">
                  <template v-if="getMedian(p, tissue) !== null">
                    <span style="font-weight: 600;">{{ getMedian(p, tissue).toFixed(2) }}</span>
                    <span style="color: var(--text-muted); font-size: 11px; margin-left: 2px;">({{ getSampleCount(p, tissue) }})</span>
                  </template>
                  <span v-else style="color: var(--text-muted);">—</span>
                </td>
                <td>
                  <div class="bar-track">
                    <template v-for="(p, i) in proteins" :key="'bar-' + p.name + tissue">
                      <div
                        v-if="getMedian(p, tissue) !== null"
                        class="bar-dot"
                        :style="{ left: pct(getMedian(p, tissue)) + '%', background: tagColors[i] }"
                        :title="p.name + ': ' + getMedian(p, tissue).toFixed(2)"
                      ></div>
                      <div
                        v-if="getIqr(p, tissue)"
                        class="bar-range"
                        :style="{ left: pct(getIqr(p, tissue).q1) + '%', width: (pct(getIqr(p, tissue).q3) - pct(getIqr(p, tissue).q1)) + '%', background: tagColors[i] }"
                      ></div>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Legend -->
        <div style="margin-top: 14px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
          <span v-for="(p, i) in proteins" :key="'legend-' + p.name" style="font-size: 12px; display: flex; align-items: center; gap: 4px;">
            <span :style="{ width: '10px', height: '10px', borderRadius: '50%', background: tagColors[i], display: 'inline-block' }"></span>
            {{ p.name }}
          </span>
          <span style="font-size: 12px; color: var(--text-muted); margin-left: 8px;">
            Bars show IQR range. Dots mark median. Values are iBAQ log₂. (n) = sample count.
          </span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!proteins.length && !loadingData && !errorMsg" style="text-align: center; padding: 64px 0; color: var(--text-muted);">
        <div style="font-size: 40px; margin-bottom: 16px;">🔬</div>
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">Search for a protein</div>
        <div style="font-size: 13px;">Enter a UniProt accession or gene name to see tissue expression. Add up to 5 proteins to compare.</div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const tagColors = ['#409eff', '#6366f1', '#7c3aed', '#f59e0b', '#10b981']

const query = ref('')
const sourceType = ref('tissue')
const loadingData = ref(false)
const searching = ref(false)
const errorMsg = ref('')
const proteins = ref([])   // Array of { name, gene_name, tags, data, stats }

const tissueDb = ref(null)
const cellDb = ref(null)

const examples = ['P50851', 'Q96HS1', 'Q14114', 'P04637']

const sourceLabel = computed(() =>
  sourceType.value === 'tissue' ? 'Human Tissues' : 'Human Cell Lines'
)

// ── Load gzip JSON ──
async function loadGzipJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  const clone = response.clone()
  try {
    return await response.json()
  } catch {
    const ds = new DecompressionStream('gzip')
    const stream = clone.body.pipeThrough(ds)
    const text = await new Response(stream).text()
    return JSON.parse(text)
  }
}

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

// ── Box stats per tissue ──
function computeStats(entry) {
  const statsMap = {}
  if (!entry.tags || !entry.data) return statsMap
  for (let i = 0; i < entry.tags.length; i++) {
    const vals = entry.data[i]
    if (!vals || vals.length === 0) continue
    const sorted = [...vals].sort((a, b) => a - b)
    const n = sorted.length
    statsMap[entry.tags[i]] = {
      min: sorted[0],
      q1: sorted[Math.floor(n * 0.25)],
      median: sorted[Math.floor(n * 0.5)],
      q3: sorted[Math.floor(n * 0.75)],
      max: sorted[n - 1],
      count: n,
    }
  }
  return statsMap
}

// ── Add protein ──
async function addProtein() {
  const q = query.value.trim().toUpperCase()
  if (!q) return
  if (proteins.value.length >= 5) return
  if (proteins.value.some(p => p.name.toUpperCase() === q || (p.gene_name && p.gene_name.toUpperCase() === q))) {
    errorMsg.value = `"${query.value.trim()}" is already added.`
    query.value = ''
    return
  }

  errorMsg.value = ''
  searching.value = true

  try {
    const db = await getDb()
    const entry = db[q]
    if (!entry) {
      errorMsg.value = `No expression data found for "${query.value.trim()}".`
    } else {
      proteins.value.push({
        name: entry.name,
        gene_name: entry.gene_name || '',
        tags: entry.tags,
        data: entry.data,
        stats: computeStats(entry),
      })
      query.value = ''
      errorMsg.value = ''
    }
  } catch (e) {
    errorMsg.value = `Failed to load expression data: ${e.message}`
  } finally {
    searching.value = false
  }
}

function removeProtein(index) {
  proteins.value.splice(index, 1)
}

function clearResults() {
  proteins.value = []
  errorMsg.value = ''
}

function useExample(ex) {
  query.value = ex
  addProtein()
}

// ── Computed: merged tissues across all proteins ──
const allTissues = computed(() => {
  const tissues = new Set()
  for (const p of proteins.value) {
    for (const t of Object.keys(p.stats)) {
      tissues.add(t)
    }
  }
  // Sort by max median across proteins (descending)
  return [...tissues].sort((a, b) => {
    const maxA = Math.max(...proteins.value.map(p => p.stats[a]?.median ?? -Infinity))
    const maxB = Math.max(...proteins.value.map(p => p.stats[b]?.median ?? -Infinity))
    return maxB - maxA
  })
})

function getMedian(protein, tissue) {
  return protein.stats[tissue]?.median ?? null
}

function getSampleCount(protein, tissue) {
  return protein.stats[tissue]?.count ?? 0
}

function getIqr(protein, tissue) {
  return protein.stats[tissue] ?? null
}

// Global min/max for bar scaling across all proteins
const globalMin = computed(() => {
  let mn = Infinity
  for (const p of proteins.value) {
    for (const s of Object.values(p.stats)) {
      if (s.min < mn) mn = s.min
    }
  }
  return mn === Infinity ? 0 : mn
})

const globalMax = computed(() => {
  let mx = -Infinity
  for (const p of proteins.value) {
    for (const s of Object.values(p.stats)) {
      if (s.max > mx) mx = s.max
    }
  }
  return mx === -Infinity ? 1 : mx
})

function pct(val) {
  const mn = globalMin.value
  const mx = globalMax.value
  if (mx === mn) return 50
  return ((val - mn) / (mx - mn)) * 100
}

const expressionRange = computed(() => {
  if (!proteins.value.length) return '—'
  return `${globalMin.value.toFixed(1)} – ${globalMax.value.toFixed(1)}`
})
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
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font);
  cursor: pointer;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--mono);
  box-sizing: border-box;
}

.search-input:focus, .source-select:focus {
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

.example-link:hover { opacity: 0.75; }

/* Protein tags */
.protein-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--mono);
}

.tag-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.8);
  font-size: 16px;
  cursor: pointer;
  padding: 0 0 0 4px;
  line-height: 1;
}

.tag-close:hover { color: #fff; }

.results-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px;
}

.summary-stat {
  text-align: center;
  padding: 12px 20px;
  background: rgba(99,102,241,0.06);
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
  background: rgba(99,102,241,0.06);
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
  text-align: left;
}

.expr-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}

.expr-table tbody tr:last-child { border-bottom: none; }

.expr-table tbody tr:hover { background: rgba(99, 102, 241, 0.04); }

.expr-table td {
  padding: 8px 14px;
  vertical-align: middle;
}

.tissue-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
  white-space: nowrap;
  text-transform: capitalize;
}

/* Comparison bars */
.bar-track {
  position: relative;
  height: 14px;
  background: rgba(99, 102, 241, 0.06);
  border-radius: 7px;
  min-width: 140px;
}

.bar-range {
  position: absolute;
  top: 3px;
  height: 8px;
  border-radius: 4px;
  opacity: 0.25;
}

.bar-dot {
  position: absolute;
  top: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translateX(-5px);
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  z-index: 1;
}
</style>
