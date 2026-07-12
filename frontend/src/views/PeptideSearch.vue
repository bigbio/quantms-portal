<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="section-header" style="text-align: left; margin-bottom: 16px">
        <h2>Peptide &amp; Protein Search</h2>
        <p style="margin: 0">
          Find the quantms datasets that contain a peptide — optionally carrying a modification
          (e.g. Phospho on S/T/Y, Oxidation on M, TMT6plex) — or a protein (UniProt accession or gene).
          Constrain by organism, tissue and instrument.
        </p>
      </div>

      <!-- Stats ribbon -->
      <div v-if="stats" class="ps-stats">
        <div><div class="stat-value" style="font-size: 22px">{{ formatBig(stats.datasets) }}</div><div class="stat-label">Datasets</div></div>
        <div><div class="stat-value" style="font-size: 22px">{{ formatBig(stats.peptides) }}</div><div class="stat-label">Peptides</div></div>
        <div><div class="stat-value" style="font-size: 22px">{{ formatBig(stats.peptidoforms) }}</div><div class="stat-label">Peptidoforms</div></div>
        <div><div class="stat-value" style="font-size: 22px">{{ formatBig(stats.rows) }}</div><div class="stat-label">Observations</div></div>
      </div>

      <!-- Search mode toggle -->
      <div class="mode-toggle">
        <button :class="{ active: mode === 'peptide' }" @click="mode = 'peptide'">Peptide</button>
        <button :class="{ active: mode === 'protein' }" @click="mode = 'protein'">Protein</button>
      </div>

      <!-- Query bar -->
      <div class="filter-bar" style="align-items: flex-start; flex-wrap: wrap; gap: 10px">
        <div class="filter-group" style="flex-wrap: wrap">
          <input
            v-if="mode === 'peptide'"
            v-model="sequence"
            type="text"
            class="filter-search"
            style="width: 280px; text-transform: uppercase"
            placeholder="Peptide sequence (required), e.g. ADSRDPASDQMQHWK"
            @keyup.enter="run"
          />
          <input
            v-else
            v-model="proteinQuery"
            type="text"
            class="filter-search"
            style="width: 280px"
            placeholder="UniProt / gene (required), e.g. P02768 / ALBU_HUMAN"
            @keyup.enter="run"
          />

          <select v-if="mode === 'peptide'" v-model="matchMode" class="facet-select" title="Match mode">
            <option value="exact">Exact</option>
            <option value="contains">Contains</option>
            <option value="peptidoform">Peptidoform</option>
          </select>

          <select v-model="modification" class="facet-select" title="Modification — leave on “Any” to match every form">
            <option value="">Any modification (all forms)</option>
            <option value="__unmodified__">Unmodified only</option>
            <option v-for="m in modList" :key="m" :value="m">{{ m }}</option>
          </select>
          <select v-model="residue" class="facet-select" title="Modified residue" :disabled="unmodifiedOnly || !residueOptions.length">
            <option value="">Any residue</option>
            <option v-for="r in residueOptions" :key="r" :value="r">{{ r }}</option>
          </select>

          <select v-model="organism" class="facet-select" title="Organism">
            <option value="">All organisms</option>
            <option v-for="o in facets.organism" :key="o.value" :value="o.value">{{ o.value }} ({{ o.datasets }})</option>
          </select>
          <input v-model="tissue" type="text" class="filter-search" style="width: 150px" placeholder="Tissue / organism part" />
          <select v-model="instrument" class="facet-select" title="Instrument">
            <option value="">All instruments</option>
            <option v-for="i in facets.instrument" :key="i.value" :value="i.value">{{ cleanInstrument(i.value) }}</option>
          </select>
          <select v-model="collection" class="facet-select" title="Collection">
            <option value="">All collections</option>
            <option v-for="c in facets.collection" :key="c.value" :value="c.value">{{ c.value }}</option>
          </select>

          <button class="page-btn primary" style="padding: 8px 18px" :disabled="!canSearch" @click="run">Search</button>
          <button v-if="hasFilters" class="page-btn" style="padding: 8px 14px" @click="clearFilters">Clear</button>
        </div>
      </div>
      <p v-if="mode === 'peptide'" class="req-note">
        A peptide sequence is required. Leave <em>modification</em> on “Any” to match every form (modified and unmodified),
        or pick “Unmodified only” for the bare peptide.
      </p>
      <p v-else class="req-note">A protein accession or gene is required to search.</p>

      <!-- Backend unavailable -->
      <div v-if="backendDown" class="notice">
        The search service is temporarily unavailable. Please retry in a moment.
        <button class="page-btn" style="margin-left: 12px" @click="retry">Retry</button>
      </div>

      <template v-else>
        <!-- Biological profile for the searched bare peptide, above the rows -->
        <PeptideProfile v-if="mode === 'peptide' && profileSequence" :sequence="profileSequence" />
        <!-- Protein-level mirror: biological profile for the searched protein, above the rows -->
        <ProteinProfile v-if="mode === 'protein' && profileProtein" :accession="profileProtein" @pick="pickProtein" />

        <div v-if="result" class="result-count" style="margin: 8px 0 16px">
          {{ result.total_datasets }} dataset<span v-if="result.total_datasets !== 1">s</span> match
          <span v-if="query"> — <code>{{ query }}</code></span>
        </div>

        <div v-if="loading" class="loading-block">Searching…</div>

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
                <th style="text-align: center">Data</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="result.datasets.length === 0">
                <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted)">No datasets match.</td>
              </tr>
              <tr v-for="ds in result.datasets" :key="ds.dataset_ref">
                <td>
                  <router-link :to="`/collections/${ds.collection}/${ds.dataset_accession}`" class="accession-link">{{ ds.dataset_accession }}</router-link>
                </td>
                <td><span class="tag" :class="collectionTag(ds.collection)">{{ ds.collection }}</span></td>
                <td style="font-size: 13px">{{ ds.organism || '—' }}</td>
                <td style="font-size: 13px; color: var(--text-secondary)">{{ cleanInstrument(ds.instrument) || '—' }}</td>
                <td class="td-num">{{ formatNum(ds.n_peptidoforms) }}</td>
                <td class="td-num">{{ formatNum(ds.total_obs) }}</td>
                <td style="font-size: 12px">
                  <code v-for="pf in (ds.sample_peptidoforms || []).slice(0, 3)" :key="pf" class="pf-chip">{{ pf }}</code>
                  <span v-if="ds.n_peptidoforms > 3" style="color: var(--text-muted)"> +{{ ds.n_peptidoforms - 3 }}</span>
                </td>
                <td style="text-align: center">
                  <a v-if="ds.dataset_url" :href="ds.dataset_url" target="_blank" rel="noopener" class="dl-link" title="Browse dataset">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                  <span v-else style="color: var(--text-muted)">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="hint">
          Try <code @click="demo('ADSRDPASDQMQHWK', 'Oxidation', 'M')">ADSRDPASDQMQHWK</code> with Oxidation on M,
          search a specific peptidoform
          <code @click="demoPeptidoform('.(Acetyl)ADSRDPASDQM(Oxidation)QHWK')">.(Acetyl)ADSRDPASDQM(Oxidation)QHWK</code>,
          or switch to Protein and search <code @click="demoProtein('ALBU_HUMAN')">ALBU_HUMAN</code> (Serum albumin).
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiGet } from '../api.js'
import { PEPTIDE_SEARCH_BASE } from '../config.js'
import { formatNum, formatBig, cleanInstrument, collectionTag } from '../utils/format.js'
import PeptideProfile from '../components/PeptideProfile.vue'
import ProteinProfile from '../components/ProteinProfile.vue'

// Fallbacks used only until the data-driven /modifications vocabulary loads (or
// if it is unavailable): the current free behavior is preserved.
const MODS = ['Phospho', 'Oxidation', 'Acetyl', 'TMT6plex', 'Carbamidomethyl', 'GlyGly', 'Methyl', 'Deamidated']
const RESIDUES = ['S', 'T', 'Y', 'M', 'K', 'N', 'Q', 'C', 'R', 'N-term', 'C-term']

const route = useRoute()
const router = useRouter()

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
const stats = ref(null)
const result = ref(null)
const query = ref('')
const loading = ref(false)
const backendDown = ref(false)

// Bare peptide whose biological profile is currently shown (set when a peptide
// search runs; independent of the live input box).
const profileSequence = ref('')

// Protein query whose biological profile is currently shown (set when a protein
// search runs; independent of the live input box). The protein-level mirror of
// profileSequence.
const profileProtein = ref('')

// Data-driven modification vocabulary: [{ name, residues[], n_datasets }].
// Empty until /modifications loads; drives the modification→residue cascade so
// impossible combos (e.g. Carbamidomethyl@M) are never offered.
const modVocab = ref([])

// Modification names for the dropdown: from the vocabulary when available,
// otherwise the static fallback.
const modList = computed(() =>
  modVocab.value.length ? modVocab.value.map((m) => m.name) : MODS
)

// Residues valid for the chosen modification. With a vocabulary and a known
// modification, only its real residues; otherwise the full fallback list.
const residueOptions = computed(() => {
  if (modVocab.value.length && modification.value && !unmodifiedOnly.value) {
    const entry = modVocab.value.find((m) => m.name === modification.value)
    if (entry) return entry.residues || []
  }
  return RESIDUES
})

// "Unmodified only" is a sentinel value of the modification dropdown: it maps to
// the backend's `unmodified=true` flag (bare peptides with no mods) rather than a
// modification name, so it is mutually exclusive with a chosen residue.
const unmodifiedOnly = computed(() => modification.value === '__unmodified__')

const hasFilters = computed(() =>
  !!(modification.value || residue.value || organism.value || tissue.value || instrument.value || collection.value)
)
const canSearch = computed(() =>
  mode.value === 'peptide' ? !!sequence.value.trim() : !!proteinQuery.value.trim()
)

// Reduce an OpenMS peptidoform (e.g. ".(Acetyl)ADSRM(Oxidation)K") to its bare
// backbone ("ADSRMK") so the profile endpoint, which keys on bare_peptide, gets
// a clean sequence. Bare inputs pass through unchanged.
function bareOf(seq) {
  return String(seq || '')
    .replace(/\([^)]*\)/g, '') // drop (Mod) groups
    .replace(/\[[^\]]*\]/g, '') // drop [Mass] groups
    .replace(/[^A-Za-z]/g, '') // drop dots / digits / separators
    .toUpperCase()
}

function buildParams() {
  return {
    modification: unmodifiedOnly.value ? undefined : (modification.value || undefined),
    unmodified: unmodifiedOnly.value ? true : undefined,
    residue: unmodifiedOnly.value ? undefined : (residue.value || undefined),
    organism: organism.value || undefined,
    tissue: tissue.value || undefined,
    instrument: instrument.value || undefined,
    collection: collection.value || undefined,
  }
}

// --- Shareable/deep-linkable URL state -------------------------------------
// Guard so that programmatic route updates (from run) don't re-trigger the
// route watcher and cause a loop.
let applyingRoute = false

// Current search state -> minimal, human-readable query object (empty values
// and defaults omitted).
function currentQuery() {
  const q = {}
  if (mode.value === 'protein') {
    q.mode = 'protein'
    if (proteinQuery.value.trim()) q.query = proteinQuery.value.trim()
  } else {
    if (sequence.value.trim()) q.sequence = sequence.value.trim().toUpperCase()
    if (matchMode.value && matchMode.value !== 'exact') q.match = matchMode.value
  }
  if (unmodifiedOnly.value) q.unmodified = '1'
  else if (modification.value) q.modification = modification.value
  if (residue.value && !unmodifiedOnly.value) q.residue = residue.value
  if (organism.value) q.organism = organism.value
  if (tissue.value) q.tissue = tissue.value
  if (instrument.value) q.instrument = instrument.value
  if (collection.value) q.collection = collection.value
  return q
}

// Query object -> form refs.
function applyQuery(q) {
  mode.value = q.mode === 'protein' ? 'protein' : 'peptide'
  sequence.value = q.sequence || ''
  proteinQuery.value = q.query || ''
  matchMode.value = q.match || 'exact'
  modification.value = q.unmodified ? '__unmodified__' : (q.modification || '')
  residue.value = q.residue || ''
  organism.value = q.organism || ''
  tissue.value = q.tissue || ''
  instrument.value = q.instrument || ''
  collection.value = q.collection || ''
}

async function init() {
  // facets (filter dropdowns) and stats (ribbon) are best-effort: a hiccup on
  // either must NOT block the search itself. Only an actual search failure
  // (in run) raises the "unavailable" banner.
  try {
    facets.value = await apiGet(PEPTIDE_SEARCH_BASE, '/facets')
  } catch (e) {
    // filter dropdowns stay empty; search still works
  }
  try {
    stats.value = await apiGet(PEPTIDE_SEARCH_BASE, '/stats')
  } catch (e) {
    // stats are optional; ignore
  }
  try {
    // Modification vocabulary drives the residue cascade. Best-effort: if it is
    // unavailable the selectors fall back to the free static lists.
    const data = await apiGet(PEPTIDE_SEARCH_BASE, '/modifications')
    modVocab.value = Array.isArray(data?.modifications) ? data.modifications : []
  } catch (e) {
    // no vocabulary; static fallbacks remain in effect
  }
}

// Keep the residue selection consistent with the chosen modification: if the
// current residue is not valid for the new modification, clear it.
watch(modification, () => {
  if (residue.value && !residueOptions.value.includes(residue.value)) {
    residue.value = ''
  }
})

// Retry from the "unavailable" banner: re-probe facets/stats and re-run the
// current search.
function retry() {
  init()
  run()
}

async function run() {
  if (!canSearch.value) return
  // Reflect the search into the URL so it can be shared/bookmarked. Use
  // replace() so repeated searches don't spam browser history.
  if (!applyingRoute) router.replace({ query: currentQuery() }).catch(() => {})
  loading.value = true
  result.value = null
  try {
    const params = buildParams()
    let path
    if (mode.value === 'peptide') {
      params.sequence = sequence.value.trim().toUpperCase()
      params.match = matchMode.value
      query.value = params.sequence
      // Drive the biological profile from the searched bare peptide. A specific
      // peptidoform query still profiles its bare backbone (mods stripped).
      profileSequence.value = bareOf(params.sequence)
      profileProtein.value = ''
      path = '/search/peptide'
    } else {
      params.query = proteinQuery.value.trim()
      query.value = params.query
      profileSequence.value = ''
      // Drive the protein biological profile from the searched accession/gene.
      profileProtein.value = params.query
      path = '/search/protein'
    }
    result.value = await apiGet(PEPTIDE_SEARCH_BASE, path, params)
    backendDown.value = false
  } catch (e) {
    backendDown.value = true
  } finally {
    loading.value = false
  }
}

function demo(seq, mod, res) {
  mode.value = 'peptide'
  matchMode.value = 'exact'
  sequence.value = seq
  modification.value = mod
  residue.value = res
  run()
}
// Demo a specific peptidoform search (match mode = peptidoform): the sequence is
// the full OpenMS peptidoform, so the modification/residue filters are cleared.
function demoPeptidoform(peptidoform) {
  mode.value = 'peptide'
  matchMode.value = 'peptidoform'
  modification.value = ''
  residue.value = ''
  sequence.value = peptidoform
  run()
}
function demoProtein(q) {
  mode.value = 'protein'
  proteinQuery.value = q
  run()
}
// A "did you mean" candidate was chosen in ProteinProfile: re-run the protein
// search/profile for that exact accession. Reuses the normal protein-search
// path (run), which sets profileProtein and refreshes the shareable URL.
function pickProtein(accession) {
  const acc = (accession || '').trim()
  if (!acc) return
  mode.value = 'protein'
  proteinQuery.value = acc
  run()
}
function clearFilters() {
  modification.value = ''
  residue.value = ''
  organism.value = ''
  tissue.value = ''
  instrument.value = ''
  collection.value = ''
}

// Populate the form from the incoming URL and auto-run when a searchable query
// is present, so a shared/bookmarked link reproduces the exact search.
watch(
  () => route.query,
  (q) => {
    applyingRoute = true
    applyQuery(q)
    if (canSearch.value) run()
    applyingRoute = false
  }
)

onMounted(() => {
  init()
  applyQuery(route.query)
  if (canSearch.value) run()
})
</script>

<style scoped>
.ps-stats {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.mode-toggle {
  display: inline-flex;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.mode-toggle button {
  padding: 8px 22px;
  background: var(--surface);
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  font-family: var(--font);
  font-size: 14px;
}
.mode-toggle button.active {
  background: var(--indigo);
  color: #fff;
}
.facet-select {
  font-family: var(--font);
  font-size: 13px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
}
.facet-select:focus {
  border-color: var(--indigo);
}
.page-btn.primary {
  background: var(--indigo);
  color: #fff;
  border-color: var(--indigo);
}
.page-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.req-note {
  font-size: 12px;
  color: var(--text-muted);
  margin: 4px 0 12px;
}
.num {
  text-align: right;
}
.td-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pf-chip {
  display: inline-block;
  margin: 1px 3px 1px 0;
  padding: 1px 6px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 11px;
  white-space: nowrap;
}
.dl-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--indigo);
  width: 30px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.dl-link:hover {
  border-color: var(--indigo);
  background: rgba(99, 102, 241, 0.06);
}
.loading-block {
  text-align: center;
  padding: 56px 0;
  color: var(--text-muted);
}
.notice,
.hint {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-secondary);
  margin-top: 16px;
}
.hint code,
.notice code {
  cursor: pointer;
  color: var(--indigo);
}
</style>
