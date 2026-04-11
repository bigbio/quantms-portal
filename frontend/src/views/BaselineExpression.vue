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
                <th style="text-align: center;">Samples</th>
                <th v-for="(p, i) in proteins" :key="p.name" style="text-align: center; min-width: 80px;">
                  <span :style="{ color: tagColors[i], fontWeight: 700 }">{{ p.name }}</span>
                  <div v-if="p.gene_name" style="font-size: 10px; font-weight: 400; color: var(--text-muted);">{{ p.gene_name }}</div>
                </th>
                <th style="min-width: 180px; text-align: center;">Expression</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tissue in allTissues" :key="tissue">
                <td class="tissue-name">{{ tissue }}</td>
                <td style="text-align: center; font-size: 12px; color: var(--text-muted);">
                  {{ maxSampleCount(tissue) }}
                </td>
                <!-- Heatmap-colored median cells -->
                <td v-for="(p, i) in proteins" :key="p.name + tissue" class="heatmap-cell"
                    :style="heatmapStyle(p, tissue, i)">
                  <template v-if="getMedian(p, tissue) !== null">
                    {{ getMedian(p, tissue).toFixed(2) }}
                  </template>
                  <span v-else style="color: var(--text-muted); font-size: 11px;">—</span>
                </td>
                <!-- Dot strip chart: shared X axis, one Y lane per protein -->
                <td style="vertical-align: middle; padding: 4px 8px; text-align: center;">
                  <svg :width="stripWidth" :height="proteins.length * stripRowH + 4" style="display:inline-block;">
                    <!-- Subtle axis baseline -->
                    <line :x1="stripPad" :y1="proteins.length * stripRowH + 2"
                          :x2="stripWidth - stripPad" :y2="proteins.length * stripRowH + 2"
                          stroke="#e2e8f0" stroke-width="0.6" />
                    <template v-for="(p, i) in proteins" :key="'strip-' + p.name + tissue">
                      <g v-if="getIqr(p, tissue)" :transform="'translate(0,' + (i * stripRowH + stripRowH / 2 + 2) + ')'" style="cursor:pointer;">
                        <title>{{ p.name }}: median={{ getIqr(p, tissue).median.toFixed(2) }}, IQR={{ getIqr(p, tissue).q1.toFixed(2) }}–{{ getIqr(p, tissue).q3.toFixed(2) }}, n={{ getIqr(p, tissue).count }}</title>
                        <!-- Invisible hit area for the whole lane -->
                        <rect :x="stripPad" :y="-stripRowH/2" :width="stripWidth - stripPad*2" :height="stripRowH" fill="transparent" />
                        <!-- IQR whisker: Q1 → Q3 -->
                        <line
                          :x1="stripX(getIqr(p, tissue).q1)" :x2="stripX(getIqr(p, tissue).q3)"
                          y1="0" y2="0"
                          :stroke="tagColors[i]" stroke-width="2.5" stroke-linecap="round" opacity="0.4"
                        />
                        <!-- Q1 end cap -->
                        <line :x1="stripX(getIqr(p, tissue).q1)" :x2="stripX(getIqr(p, tissue).q1)"
                          y1="-2" y2="2" :stroke="tagColors[i]" stroke-width="1" opacity="0.5" />
                        <!-- Q3 end cap -->
                        <line :x1="stripX(getIqr(p, tissue).q3)" :x2="stripX(getIqr(p, tissue).q3)"
                          y1="-2" y2="2" :stroke="tagColors[i]" stroke-width="1" opacity="0.5" />
                        <!-- Median dot -->
                        <circle
                          :cx="stripX(getIqr(p, tissue).median)" cy="0" r="4"
                          :fill="tagColors[i]" stroke="#fff" stroke-width="1.5"
                        />
                      </g>
                      <!-- Not detected: dashed line -->
                      <g v-else :transform="'translate(0,' + (i * stripRowH + stripRowH / 2 + 2) + ')'">
                        <line :x1="stripPad + 4" :x2="stripWidth - stripPad - 4"
                          y1="0" y2="0" stroke="#cbd5e1" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.4" />
                      </g>
                    </template>
                  </svg>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Legend -->
        <div class="legend-bar">
          <div class="legend-items">
            <span v-for="(p, i) in proteins" :key="'legend-' + p.name" class="legend-item">
              <span class="legend-dot" :style="{ background: tagColors[i] }"></span>
              {{ p.name }}
            </span>
          </div>
          <div class="legend-guide">
            <svg width="180" height="16" style="vertical-align: middle;">
              <!-- Whisker -->
              <line x1="8" x2="52" y1="8" y2="8" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" opacity="0.4" />
              <!-- Q1 cap -->
              <line x1="8" x2="8" y1="5" y2="11" stroke="#6366f1" stroke-width="1" opacity="0.5" />
              <!-- Q3 cap -->
              <line x1="52" x2="52" y1="5" y2="11" stroke="#6366f1" stroke-width="1" opacity="0.5" />
              <!-- Median dot -->
              <circle cx="30" cy="8" r="4" fill="#6366f1" stroke="#fff" stroke-width="1.5" />
              <text x="62" y="11" font-size="10" fill="#94a3b8" font-family="var(--font)">Q1 ● median Q3 — hover for values</text>
            </svg>
          </div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const tagColors = ['#409eff', '#6366f1', '#7c3aed', '#f59e0b', '#10b981']

const query = ref('')
const sourceType = ref('tissue')
const loadingData = ref(false)
const searching = ref(false)
const errorMsg = ref('')
const proteins = ref([])   // Array of { name, gene_name, tags, data, stats }

const tissueDb = ref(null)
const cellDb = ref(null)

// Sync proteins to URL: /baseline?proteins=P50851,Q96HS1
function updateUrl() {
  const names = proteins.value.map(p => p.name)
  const q = {}
  if (names.length) q.proteins = names.join(',')
  if (sourceType.value !== 'tissue') q.source = sourceType.value
  router.replace({ path: '/baseline', query: q })
}

watch(proteins, updateUrl, { deep: true })
watch(sourceType, updateUrl)

// Load proteins from URL on mount
onMounted(async () => {
  const urlProteins = route.query.proteins
  const urlSource = route.query.source
  if (urlSource === 'cell') sourceType.value = 'cell'
  if (urlProteins) {
    const names = urlProteins.split(',').map(s => s.trim()).filter(Boolean)
    for (const name of names.slice(0, 5)) {
      query.value = name
      await addProtein()
    }
    query.value = ''
  }
})

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

// Max sample count across all proteins for a tissue
function maxSampleCount(tissue) {
  return Math.max(...proteins.value.map(p => p.stats[tissue]?.count ?? 0))
}

// ── Heatmap cell coloring ──
// Color-codes the median cell: white (low) → saturated protein color (high)
const tagColorsRGB = [
  [64, 158, 255],   // blue
  [99, 102, 241],   // indigo
  [124, 58, 237],   // violet
  [245, 158, 11],   // amber
  [16, 185, 129],   // green
]

function heatmapStyle(protein, tissue, colorIndex) {
  const median = getMedian(protein, tissue)
  if (median === null) return {}
  const mn = globalMin.value
  const mx = globalMax.value
  const intensity = mx === mn ? 0.5 : (median - mn) / (mx - mn)
  const alpha = 0.08 + intensity * 0.18  // subtle: 0.08 → 0.26
  const [r, g, b] = tagColorsRGB[colorIndex] || tagColorsRGB[0]
  return {
    background: `rgba(${r}, ${g}, ${b}, ${alpha})`,
    color: intensity > 0.6 ? `rgb(${r}, ${g}, ${b})` : 'var(--text-primary)',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: '13px',
  }
}

// ── Dot strip chart helpers ──
const stripWidth = 180
const stripPad = 8
const stripRowH = 12

function stripX(val) {
  const mn = globalMin.value
  const mx = globalMax.value
  if (mx === mn) return stripWidth / 2
  return stripPad + ((val - mn) / (mx - mn)) * (stripWidth - stripPad * 2)
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

/* Heatmap cells */
.heatmap-cell {
  transition: background 0.2s;
  border-left: 1px solid var(--border);
}

/* Dot strip chart */

/* Legend bar */
.legend-bar {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(99,102,241,0.04);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.legend-items {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.legend-item {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.legend-guide {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
