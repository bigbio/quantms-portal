<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">
      <div class="section-header" style="text-align:left; margin-bottom:20px;">
        <h2>Peptide &amp; Protein Search</h2>
        <p style="margin:0;">
          Find the quantms datasets that contain a peptide — optionally carrying a modification
          (e.g. Phospho on S/T/Y, Oxidation on M, TMT6plex) — or a protein (UniProt accession or gene).
          Constrain by organism, tissue and instrument.
        </p>
      </div>

      <!-- Search mode toggle -->
      <div class="mode-toggle">
        <button :class="{ active: mode==='peptide' }" @click="mode='peptide'">Peptide</button>
        <button :class="{ active: mode==='protein' }" @click="mode='protein'">Protein</button>
      </div>

      <!-- Query bar -->
      <div class="filter-bar" style="align-items:flex-start; flex-wrap:wrap; gap:10px;">
        <div class="filter-group" style="flex-wrap:wrap;">
          <input
            v-if="mode==='peptide'"
            v-model="sequence"
            type="text"
            class="filter-search"
            style="width:280px; text-transform:uppercase;"
            placeholder="Peptide sequence, e.g. ADSRDPASDQMQHWK"
            @keyup.enter="run"
          />
          <input
            v-else
            v-model="proteinQuery"
            type="text"
            class="filter-search"
            style="width:280px;"
            placeholder="UniProt accession or gene, e.g. P04040 / CATA"
            @keyup.enter="run"
          />

          <select v-if="mode==='peptide'" v-model="matchMode" class="facet-select" title="Match mode">
            <option value="exact">Exact</option>
            <option value="contains">Contains</option>
            <option value="peptidoform">Peptidoform</option>
          </select>

          <!-- Modification filters (both modes) -->
          <select v-model="modification" class="facet-select" title="Modification">
            <option value="">Any modification</option>
            <option v-for="m in MODS" :key="m" :value="m">{{ m }}</option>
          </select>
          <select v-model="residue" class="facet-select" title="Modified residue">
            <option value="">Any residue</option>
            <option v-for="r in RESIDUES" :key="r" :value="r">{{ r }}</option>
          </select>

          <!-- Metadata facets -->
          <select v-model="organism" class="facet-select" title="Organism">
            <option value="">All organisms</option>
            <option v-for="o in facets.organism" :key="o.value" :value="o.value">
              {{ o.value }} ({{ o.datasets }})
            </option>
          </select>
          <input v-model="tissue" type="text" class="filter-search" style="width:150px;" placeholder="Tissue / organism part" />
          <select v-model="instrument" class="facet-select" title="Instrument">
            <option value="">All instruments</option>
            <option v-for="i in facets.instrument" :key="i.value" :value="i.value">{{ i.value }}</option>
          </select>
          <select v-model="collection" class="facet-select" title="Collection">
            <option value="">All collections</option>
            <option v-for="c in facets.collection" :key="c.value" :value="c.value">{{ c.value }}</option>
          </select>

          <button class="page-btn primary" style="padding:8px 18px;" @click="run">Search</button>
          <button v-if="hasFilters" class="page-btn" style="padding:8px 14px;" @click="clearFilters">Clear</button>
        </div>
      </div>

      <!-- Backend unavailable (graceful degradation) -->
      <div v-if="backendDown" class="notice">
        The search service is temporarily unavailable. Please retry in a moment.
        <button class="page-btn" style="margin-left:12px;" @click="init">Retry</button>
      </div>

      <template v-else>
        <div v-if="result" class="result-count" style="margin:8px 0 16px;">
          {{ result.total_datasets }} dataset<span v-if="result.total_datasets !== 1">s</span> match
          <span v-if="query"> — <code>{{ query }}</code></span>
        </div>

        <div v-if="loading" style="text-align:center; padding:56px 0; color:var(--text-muted);">Searching…</div>

        <div v-else-if="result" class="dataset-table-wrap">
          <table class="dataset-table">
            <thead>
              <tr>
                <th>Accession</th>
                <th>Collection</th>
                <th>Organism</th>
                <th>Instrument</th>
                <th class="num">Peptidoforms</th>
                <th class="num">Obs.</th>
                <th>Matching peptidoform(s)</th>
                <th style="text-align:center;">Data</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="result.datasets.length === 0">
                <td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">No datasets match.</td>
              </tr>
              <tr v-for="ds in result.datasets" :key="ds.dataset_ref">
                <td>
                  <a v-if="ds.px_url" :href="ds.px_url" target="_blank" rel="noopener" class="accession-link">{{ ds.dataset_accession }}</a>
                  <span v-else class="accession-link">{{ ds.dataset_accession }}</span>
                </td>
                <td><span class="tag" :class="collectionTag(ds.collection)">{{ ds.collection }}</span></td>
                <td style="font-size:13px;">{{ ds.organism || '—' }}</td>
                <td style="font-size:13px; color:var(--text-secondary);">{{ ds.instrument || '—' }}</td>
                <td class="td-num">{{ fmtNum(ds.n_peptidoforms) }}</td>
                <td class="td-num">{{ fmtNum(ds.total_obs) }}</td>
                <td style="font-size:12px;">
                  <code v-for="pf in ds.sample_peptidoforms.slice(0,3)" :key="pf" class="pf-chip">{{ pf }}</code>
                  <span v-if="ds.n_peptidoforms > 3" style="color:var(--text-muted);"> +{{ ds.n_peptidoforms - 3 }}</span>
                </td>
                <td style="text-align:center;">
                  <a v-if="ds.dataset_url" :href="ds.dataset_url" target="_blank" rel="noopener" class="dl-link" title="Browse dataset">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                  <span v-else style="color:var(--text-muted);">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="hint">
          Try <code @click="demo('ADSRDPASDQMQHWK','Oxidation','M')">ADSRDPASDQMQHWK</code> with Oxidation on M,
          or switch to Protein and search <code @click="demoProtein('P04040')">P04040</code> (Catalase).
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Tier-2 backend base: Caddy route in prod, overridable for local dev.
const API = import.meta.env.VITE_PEPTIDE_SEARCH_API || 'https://api.quantms.org/peptide-search'

const MODS = ['Phospho', 'Oxidation', 'Acetyl', 'TMT6plex', 'Carbamidomethyl', 'GlyGly', 'Methyl', 'Deamidated']
const RESIDUES = ['S', 'T', 'Y', 'M', 'K', 'N', 'Q', 'C', 'R', 'N-term', 'C-term']

const mode = ref('peptide')
const sequence = ref('')
const proteinQuery = ref('')
const matchMode = ref('exact')
const modification = ref('')
const residue = ref('')
const organism = ref('')
const tissue = ref('')
const instrument = ref('')
const collection = ref('')

const facets = ref({ organism: [], collection: [], instrument: [] })
const result = ref(null)
const query = ref('')
const loading = ref(false)
const backendDown = ref(false)

const hasFilters = computed(() =>
  !!(modification.value || residue.value || organism.value || tissue.value || instrument.value || collection.value)
)

function buildParams() {
  const p = new URLSearchParams()
  if (modification.value) p.set('modification', modification.value)
  if (residue.value) p.set('residue', residue.value)
  if (organism.value) p.set('organism', organism.value)
  if (tissue.value) p.set('tissue', tissue.value)
  if (instrument.value) p.set('instrument', instrument.value)
  if (collection.value) p.set('collection', collection.value)
  return p
}

async function init() {
  backendDown.value = false
  try {
    const res = await fetch(`${API}/facets`)
    if (!res.ok) throw new Error(res.status)
    facets.value = await res.json()
  } catch (e) {
    backendDown.value = true
  }
}

async function run() {
  loading.value = true
  result.value = null
  try {
    const p = buildParams()
    let url
    if (mode.value === 'peptide') {
      if (!sequence.value.trim()) { loading.value = false; return }
      p.set('sequence', sequence.value.trim().toUpperCase())
      p.set('match', matchMode.value)
      query.value = sequence.value.trim().toUpperCase()
      url = `${API}/search/peptide?${p.toString()}`
    } else {
      if (!proteinQuery.value.trim()) { loading.value = false; return }
      p.set('query', proteinQuery.value.trim())
      query.value = proteinQuery.value.trim()
      url = `${API}/search/protein?${p.toString()}`
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error(res.status)
    result.value = await res.json()
    backendDown.value = false
  } catch (e) {
    backendDown.value = true
  } finally {
    loading.value = false
  }
}

function demo(seq, mod, res) {
  mode.value = 'peptide'; sequence.value = seq; modification.value = mod; residue.value = res; run()
}
function demoProtein(q) {
  mode.value = 'protein'; proteinQuery.value = q; run()
}
function clearFilters() {
  modification.value = ''; residue.value = ''; organism.value = ''
  tissue.value = ''; instrument.value = ''; collection.value = ''
}

function collectionTag(name) {
  switch (name) {
    case 'absolute-expression': return 'tag-indigo'
    case 'differential-expression': return 'tag-violet'
    case 'msnet': return 'tag-blue'
    case 'single-cell-expression': return 'tag-green'
    default: return 'tag-blue'
  }
}
function fmtNum(n) {
  if (n == null || n === '') return '—'
  return Number(n).toLocaleString()
}

onMounted(init)
</script>

<style scoped>
.mode-toggle { display:inline-flex; margin-bottom:16px; border:1px solid var(--border); border-radius:8px; overflow:hidden; }
.mode-toggle button {
  padding:8px 22px; background:var(--surface); color:var(--text-secondary);
  border:none; cursor:pointer; font-family:var(--font); font-size:14px;
}
.mode-toggle button.active { background:var(--indigo, #6366f1); color:#fff; }
.facet-select {
  font-family: var(--font); font-size: 13px; padding: 8px 10px;
  border: 1px solid var(--border); border-radius: 6px; background: var(--surface);
  color: var(--text-primary); cursor: pointer; outline: none;
}
.facet-select:focus { border-color: var(--indigo); }
.page-btn.primary { background: var(--indigo, #6366f1); color:#fff; border-color: var(--indigo, #6366f1); }
.num { text-align:right; } .td-num { text-align:right; font-variant-numeric: tabular-nums; }
.pf-chip {
  display:inline-block; margin:1px 3px 1px 0; padding:1px 6px;
  background: rgba(99,102,241,0.08); border:1px solid var(--border); border-radius:5px;
  font-size:11px; white-space:nowrap;
}
.dl-link {
  display:inline-flex; align-items:center; justify-content:center; color:var(--indigo);
  width:30px; height:26px; border:1px solid var(--border); border-radius:6px;
}
.dl-link:hover { border-color: var(--indigo); background: rgba(99,102,241,0.06); }
.notice, .hint {
  padding:16px 18px; border:1px solid var(--border); border-radius:8px;
  background: var(--surface); color: var(--text-secondary); margin-top:16px;
}
.hint code, .notice code { cursor:pointer; color: var(--indigo); }
</style>
