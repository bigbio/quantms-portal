<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="section-header" style="text-align: left; margin-bottom: 20px">
        <h2>Protein Co-expression</h2>
        <p style="margin: 0">
          Pick a protein to see which proteins rise and fall with it across the published
          cell-line proteomes — across every cell line, or within one lineage.
        </p>
      </div>

      <div v-if="loading" class="loading-block">Loading the co-expression index…</div>

      <div v-else-if="error" class="notice">
        The co-expression network is temporarily unavailable.
        <button class="page-btn" style="margin-left: 12px" @click="loadIndex">Retry</button>
      </div>

      <div v-else-if="!index" class="notice">No co-expression network has been published yet.</div>

      <template v-else>
        <!-- Query bar -->
        <div class="query-card">
          <div class="search-wrap">
            <label for="coexp-search" class="ctl-label">Protein</label>
            <input
              id="coexp-search"
              v-model="query"
              class="search-input"
              type="search"
              placeholder="Gene or UniProt accession, e.g. PSMA1"
              autocomplete="off"
              @keydown.enter.prevent="pickFirst"
            />
            <ul v-if="suggestions.length && showSuggestions" class="suggestions" role="listbox">
              <li v-for="p in suggestions" :key="p[0]">
                <button type="button" @click="select(p[0])">
                  <strong>{{ p[1] || p[0] }}</strong>
                  <span class="muted">{{ p[0] }} · {{ p[2] }} datasets · {{ formatNum(p[3]) }} lines</span>
                </button>
              </li>
            </ul>
          </div>

          <div class="controls">
            <label class="ctl">
              <span class="ctl-label">Scope</span>
              <select v-model="scope" :disabled="!availableScopes.length">
                <option v-for="s in availableScopes" :key="s.id" :value="s.id">
                  {{ s.label }} ({{ formatNum(s.lines) }} lines)
                </option>
              </select>
            </label>
            <label class="ctl">
              <span class="ctl-label">Min |r| {{ minAbsR.toFixed(2) }}</span>
              <input v-model.number="minAbsR" type="range" min="0" max="0.95" step="0.05" />
            </label>
            <label class="ctl">
              <span class="ctl-label">Partners</span>
              <select v-model.number="topN">
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
              </select>
            </label>
            <div class="ctl">
              <span class="ctl-label">Direction</span>
              <div class="metric-toggle">
                <button
                  v-for="d in directions"
                  :key="d.key"
                  type="button"
                  :class="{ active: sign === d.key }"
                  :aria-pressed="sign === d.key"
                  @click="sign = d.key"
                >{{ d.label }}</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!selected" class="notice">
          Search for a protein to draw its network. Try <button class="linkish" @click="select(example)">PSMA1</button>
          — its partners should be the rest of the proteasome.
        </div>

        <div v-else-if="networkLoading" class="loading-block">Loading the network for {{ selectedGene }}…</div>

        <div v-else-if="!partners.length" class="notice">
          No partners pass the current filters for {{ selectedGene }} in this scope. Lower the minimum |r|
          or switch scope.
        </div>

        <div v-else class="result-grid">
          <!-- Network -->
          <section class="chart-card">
            <div class="chart-head">
              <h3>{{ selectedGene }} <span class="muted">· {{ scopeLabel }}</span></h3>
              <span class="legend">
                <span class="swatch pos"></span> co-expressed
                <span class="swatch neg"></span> anti-correlated
              </span>
            </div>
            <svg :viewBox="`0 0 ${W} ${H}`" class="network" role="img" :aria-label="`Co-expression network of ${selectedGene}`">
              <line
                v-for="n in nodes"
                :key="`e-${n.protein}`"
                :x1="W / 2" :y1="H / 2" :x2="n.x" :y2="n.y"
                :stroke-width="edgeWidth(n.r)"
                :class="n.r > 0 ? 'edge pos' : 'edge neg'"
              />
              <g
                v-for="n in nodes"
                :key="`n-${n.protein}`"
                class="node"
                tabindex="0"
                @click="select(n.protein)"
                @keydown.enter="select(n.protein)"
              >
                <title>{{ n.gene || n.protein }} · r {{ n.r.toFixed(2) }} · {{ n.n_datasets }} datasets</title>
                <circle :cx="n.x" :cy="n.y" r="7" />
                <text
                  :x="n.x + (n.anchor === 'start' ? 11 : -11)"
                  :y="n.y + 4"
                  :text-anchor="n.anchor"
                >{{ n.gene || n.protein }}</text>
              </g>
              <g class="node centre">
                <circle :cx="W / 2" :cy="H / 2" r="14" />
                <text :x="W / 2" :y="H / 2 + 34" text-anchor="middle">{{ selectedGene }}</text>
              </g>
            </svg>
            <p class="hint">Click a partner to re-centre the network on it.</p>
          </section>

          <!-- Table -->
          <section class="chart-card">
            <div class="chart-head"><h3>Partners</h3></div>
            <table class="partners">
              <thead>
                <tr><th>Gene</th><th>Accession</th><th class="num">r</th><th class="num">Datasets</th><th class="num">Lines</th><th class="num">Sign agrees</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in partners" :key="p.protein">
                  <td><button class="linkish" @click="select(p.protein)">{{ p.gene || '—' }}</button></td>
                  <td><a :href="`https://www.uniprot.org/uniprotkb/${p.protein}`" target="_blank" rel="noopener">{{ p.protein }}</a></td>
                  <td class="num" :class="p.r > 0 ? 'pos-text' : 'neg-text'">{{ p.r.toFixed(2) }}</td>
                  <td class="num">{{ p.n_datasets }}</td>
                  <td class="num">{{ formatNum(p.n_lines) }}</td>
                  <td class="num">{{ Math.round(p.sign_agree * 100) }}%</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <p class="method">
          Correlations are computed <strong>within</strong> each published dataset, then combined across
          datasets (Fisher z, weighted by the number of lines), so DIA / TMT / label-free and lab effects do
          not appear as co-expression. Proteins at 1% protein-level FDR; unquantified values are treated as
          missing. “Sign agrees” is the share of contributing datasets whose correlation has the same sign.
          Co-expression is not physical interaction.
          <span v-if="scopeInfo"> This scope uses {{ scopeInfo.datasets.join(', ') }}.</span>
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiGet } from '../api.js'
import { BROWSE_BASE, COEXP_PATH } from '../config.js'
import { formatNum } from '../utils/format.js'
import {
  networkFile, findProteins, partnersFor, scopesWithData, radialLayout, edgeWidth, PARTNER_COLUMNS,
} from '../utils/coexpression.js'

const W = 640
const H = 600
const example = 'P25786' // PSMA1
const directions = [
  { key: 'both', label: 'Both' },
  { key: 'positive', label: 'Positive' },
  { key: 'negative', label: 'Negative' },
]

const route = useRoute()
const router = useRouter()

const index = ref(null)
const loading = ref(true)
const error = ref(false)
const networks = ref({})
const networkLoading = ref(false)

const query = ref('')
const showSuggestions = ref(false)
const selected = ref('')
const scope = ref('all')
const minAbsR = ref(0.3)
const topN = ref(25)
const sign = ref('both')

const columns = computed(() => index.value?.partner_columns || PARTNER_COLUMNS)
const geneOf = computed(() => {
  const m = {}
  for (const p of index.value?.proteins || []) m[p[0]] = p[1]
  return m
})
const selectedGene = computed(() => geneOf.value[selected.value] || selected.value)
const suggestions = computed(() => findProteins(index.value?.proteins, query.value))
const network = computed(() => networks.value[selected.value])
const availableScopes = computed(() => scopesWithData(network.value, index.value?.scopes))
const scopeInfo = computed(() => (index.value?.scopes || []).find((s) => s.id === scope.value))
const scopeLabel = computed(() => scopeInfo.value?.label || scope.value)
const partners = computed(() => partnersFor(network.value, scope.value, {
  minAbsR: minAbsR.value, topN: topN.value, sign: sign.value, columns: columns.value,
}))
const nodes = computed(() => radialLayout(partners.value, { cx: W / 2, cy: H / 2, radius: 240 }))

async function loadIndex() {
  loading.value = true
  error.value = false
  try {
    index.value = await apiGet(BROWSE_BASE, `${COEXP_PATH}/index.json`, null, { retries: 1 })
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function loadNetwork(accession) {
  if (networks.value[accession]) return
  networkLoading.value = true
  try {
    const data = await apiGet(BROWSE_BASE, `${COEXP_PATH}/network/${networkFile(accession)}.json`, null, { retries: 1 })
    networks.value = { ...networks.value, [accession]: data }
  } catch (e) {
    networks.value = { ...networks.value, [accession]: {} }
  } finally {
    networkLoading.value = false
  }
}

async function select(accession) {
  if (!accession) return
  showSuggestions.value = false
  query.value = geneOf.value[accession] || accession
  selected.value = accession
  await loadNetwork(accession)
  if (!availableScopes.value.some((s) => s.id === scope.value)) {
    scope.value = availableScopes.value[0]?.id || 'all'
  }
  router.replace({ query: { ...route.query, protein: accession, scope: scope.value } })
}

function pickFirst() {
  if (suggestions.value.length) select(suggestions.value[0][0])
}

watch(query, (q) => { showSuggestions.value = !!q && (geneOf.value[selected.value] || selected.value) !== q })
watch(scope, (s) => { if (selected.value) router.replace({ query: { ...route.query, scope: s } }) })

onMounted(async () => {
  await loadIndex()
  const q = route.query
  if (q.scope) scope.value = String(q.scope)
  if (q.protein && index.value) await select(String(q.protein))
})
</script>

<style scoped>
.query-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 2fr;
  gap: 20px;
  margin-bottom: 20px;
}
.search-wrap { position: relative; display: flex; flex-direction: column; gap: 6px; }
.search-input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--bg);
  color: var(--text-primary);
}
.search-input:focus-visible { outline: 2px solid var(--indigo); outline-offset: 1px; }
.suggestions {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
  list-style: none; margin: 4px 0 0; padding: 4px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); max-height: 320px; overflow-y: auto;
}
.suggestions button {
  width: 100%; text-align: left; background: none; border: 0; padding: 8px 10px;
  border-radius: 6px; display: flex; gap: 10px; align-items: baseline; cursor: pointer; color: var(--text-primary);
}
.suggestions button:hover, .suggestions button:focus-visible { background: var(--bg-alt); outline: none; }
.controls { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-end; }
.ctl { display: flex; flex-direction: column; gap: 6px; }
.ctl-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
.ctl select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text-primary); }
.metric-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.metric-toggle button { background: none; border: 0; padding: 7px 12px; cursor: pointer; color: var(--text-secondary); }
.metric-toggle button.active { background: var(--indigo); color: #fff; }
.result-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 20px; }
.chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; }
.chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
.chart-head h3 { margin: 0; font-size: 1.1rem; }
.legend { font-size: 0.82rem; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px; }
.swatch { display: inline-block; width: 18px; height: 3px; border-radius: 2px; margin-left: 8px; }
.swatch.pos, .edge.pos { background: var(--indigo); stroke: var(--indigo); }
.swatch.neg, .edge.neg { background: #d97706; stroke: #d97706; }
.network { width: 100%; height: auto; display: block; }
.edge { stroke-opacity: 0.55; }
.node { cursor: pointer; }
.node circle { fill: var(--surface); stroke: var(--indigo); stroke-width: 2; }
.node text { font-size: 12px; fill: var(--text-primary); }
.node:hover circle, .node:focus-visible circle { fill: var(--indigo); }
.node:focus-visible { outline: none; }
.node.centre circle { fill: var(--indigo); }
.node.centre text { font-weight: 700; font-size: 14px; }
.hint { font-size: 0.8rem; color: var(--text-muted); margin: 6px 0 0; }
.partners { width: 100%; border-collapse: collapse; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
.partners th { text-align: left; font-weight: 600; color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 8px; border-bottom: 1px solid var(--border); }
.partners td { padding: 6px 8px; border-bottom: 1px solid var(--border-subtle); }
.partners .num { text-align: right; }
.pos-text { color: var(--indigo); }
.neg-text { color: #b45309; }
.linkish { background: none; border: 0; padding: 0; color: var(--indigo); cursor: pointer; font: inherit; text-decoration: underline; }
.muted { color: var(--text-muted); font-weight: 400; font-size: 0.85em; }
.method { font-size: 0.85rem; color: var(--text-secondary); margin-top: 20px; max-width: 72ch; line-height: 1.55; }
@media (max-width: 900px) {
  .query-card, .result-grid { grid-template-columns: 1fr; }
}
</style>
