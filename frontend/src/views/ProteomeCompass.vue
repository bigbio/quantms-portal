<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="section-header" style="text-align: left; margin-bottom: 16px">
        <h2>Proteome Compass</h2>
        <p style="margin: 0; max-width: none">
          Every protein's quantms MS evidence next to <strong>PeptideAtlas</strong>, <strong>UniProt&nbsp;PE</strong>,
          and <strong>HPA</strong> — with the coverage gaps (reanalysis targets, PE-upgrade candidates) as
          first-class, queryable objects. Across every species in the corpus.
        </p>
      </div>

      <div class="mode-toggle" role="group" aria-label="Compass view">
        <button v-for="m in MODES" :key="m.id" type="button" :class="{ active: mode === m.id }"
          :aria-pressed="mode === m.id" @click="mode = m.id">{{ m.label }}</button>
      </div>

      <!-- Async load state: spinner while loading, retry banner on failure (never a fake-empty table) -->
      <p v-if="loading" class="cc-loading">Loading…</p>
      <p v-else-if="loadErr" class="cc-err">{{ loadErr }} <button type="button" class="cc-retry" @click="loadForMode">Retry</button></p>

      <!-- Protein mode -->
      <div v-if="mode === 'protein'">
        <div class="filter-bar">
          <input v-model="acc" class="filter-search" style="width: 260px; text-transform: uppercase"
            placeholder="UniProt accession, e.g. P04637" @keyup.enter="lookup" aria-label="UniProt accession" />
          <button class="btn" @click="lookup">Look up</button>
        </div>
        <p v-if="profileErr" class="cc-muted">{{ profileErr }}</p>
        <CompassProteinCard v-if="profile && profile.uniprot_acc" :profile="profile" />
      </div>

      <!-- Proteomes mode: cross-species completeness scoreboard -->
      <div v-else-if="mode === 'proteomes'">
        <div class="filter-bar">
          <input v-model="orgFilter" class="filter-search" placeholder="Filter organisms…" aria-label="Filter organisms" />
          <span class="cc-muted" v-if="proteomes.length">{{ filteredProteomes.length }} / {{ proteomes.length }} proteomes</span>
        </div>
        <table class="cc-table">
          <thead><tr>
            <th scope="col" class="sortable" tabindex="0" :aria-sort="ariaSort('common_name')" @click="sortBy('common_name')" @keyup.enter="sortBy('common_name')">Organism</th>
            <th scope="col" class="sortable" tabindex="0" :aria-sort="ariaSort('kingdom')" @click="sortBy('kingdom')" @keyup.enter="sortBy('kingdom')">Kingdom</th>
            <th scope="col" class="sortable num" tabindex="0" :aria-sort="ariaSort('n_swissprot')" @click="sortBy('n_swissprot')" @keyup.enter="sortBy('n_swissprot')">Proteins (SP / full)</th>
            <th scope="col" class="sortable num" tabindex="0" :aria-sort="ariaSort('pct_swissprot_covered_quantms')" @click="sortBy('pct_swissprot_covered_quantms')" @keyup.enter="sortBy('pct_swissprot_covered_quantms')">quantms %</th>
            <th scope="col" class="sortable num" tabindex="0" :aria-sort="ariaSort('pct_swissprot_covered_pa')" @click="sortBy('pct_swissprot_covered_pa')" @keyup.enter="sortBy('pct_swissprot_covered_pa')">PeptideAtlas %</th>
            <th scope="col" class="sortable num" tabindex="0" :aria-sort="ariaSort('n_gpp_passing')" @click="sortBy('n_gpp_passing')" @keyup.enter="sortBy('n_gpp_passing')">GPP-passing</th>
            <th scope="col">Tiers</th>
            <th scope="col" class="sortable num" tabindex="0" :aria-sort="ariaSort('reanalysis_headroom')" @click="sortBy('reanalysis_headroom')" @keyup.enter="sortBy('reanalysis_headroom')">Headroom</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in filteredProteomes" :key="r.organism" class="org-row" tabindex="0" role="button" :aria-label="`Open gap finder for ${r.common_name}`" @click="openOrganism(r)" @keyup.enter="openOrganism(r)">
              <td><strong>{{ r.common_name }}</strong><br><small class="cc-muted">{{ r.organism }}</small></td>
              <td>{{ r.kingdom || '—' }}</td>
              <td class="num">{{ fmt(r.n_swissprot) }} / {{ fmt(r.n_full) }}</td>
              <td class="num">{{ pct(r.pct_swissprot_covered_quantms ?? r.pct_full_covered_quantms) }}<br><small class="cc-muted">{{ pct(r.pct_full_covered_quantms) }} full</small></td>
              <td class="num">{{ r.pct_swissprot_covered_pa == null ? 'no build' : pct(r.pct_swissprot_covered_pa) }}</td>
              <td class="num">{{ fmt(r.n_gpp_passing) }}</td>
              <td><span class="tierbar"><span v-for="t in TIERS" :key="t" :class="'tseg tier-' + t" :style="tierWidth(r, t)" :title="t + ': ' + (r.by_tier[t] || 0)"></span></span></td>
              <td class="num">{{ fmt(r.reanalysis_headroom) }}</td>
            </tr>
            <tr v-if="!filteredProteomes.length"><td colspan="8" class="cc-muted">No proteomes.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Gap Finder mode -->
      <div v-else-if="mode === 'gaps'">
        <div v-if="summary && summary.n_full" class="cc-cards">
          <div class="cc-metric">
            <div class="m-val">{{ pct(summary.pct_swissprot_covered_quantms) }}</div>
            <div class="m-lab">SwissProt covered by quantms<br><small>{{ pct(summary.pct_full_covered_quantms) }} of full proteome</small></div>
          </div>
          <div class="cc-metric">
            <div class="m-val">{{ pct(summary.pct_swissprot_covered_pa) }}</div>
            <div class="m-lab">SwissProt covered by PeptideAtlas<br><small>{{ pct(summary.pct_full_covered_pa) }} of full proteome</small></div>
          </div>
          <div class="cc-metric"><div class="m-val">{{ pct(summary.pct_pa_recovered_by_quantms) }}</div><div class="m-lab">of PeptideAtlas also in quantms<br><small>quantms = proteins passing GPP</small></div></div>
          <div class="cc-metric">
            <div class="m-val">{{ fmt(summary.n_swissprot) }}</div>
            <div class="m-lab">SwissProt proteins<br><small>{{ fmt(summary.n_full) }} incl. TrEMBL <template v-if="summary.reference_proteome_upid">· {{ summary.reference_proteome_upid }}</template></small></div>
          </div>
        </div>

        <h3 class="cc-h3">Unobserved reviewed proteins
          <small>— SwissProt entries quantms hasn't detected yet<template v-if="summary && summary.reanalysis_headroom != null"> · {{ fmt(summary.reanalysis_headroom) }} total (your reanalysis headroom), ranked by PE</template></small></h3>
        <GapTable :columns="unobservedCols" :rows="unobserved" empty-message="None — quantms already covers the full reviewed proteome for this organism.">
          <template #links="{ row }"><CompassLinks :acc="row.uniprot_acc" /></template>
        </GapTable>

        <h3 class="cc-h3">Reanalysis targets <small>— PeptideAtlas observes them, quantms doesn't (ranked)</small></h3>
        <GapTable :columns="targetsCols" :rows="targets" :empty-message="targetsEmpty">
          <template #links="{ row }"><CompassLinks :acc="row.uniprot_acc" /></template>
        </GapTable>

        <h3 class="cc-h3">PE-upgrade candidates <small>— MS-confirmed, UniProt PE below 1 (HPP-framed)</small></h3>
        <GapTable :columns="peUpsCols" :rows="peUps" :empty-message="peUpsEmpty">
          <template #links="{ row }"><CompassLinks :acc="row.uniprot_acc" /></template>
        </GapTable>
      </div>

      <!-- Explorer mode -->
      <div v-else>
        <div class="cc-presets">
          <span class="cc-muted">Set queries:</span>
          <button v-for="p in presets" :key="p.id" class="chip" :class="{ active: preset === p.id }" @click="applyPreset(p.id)">{{ p.label }}</button>
          <button v-if="preset" class="chip clear" @click="applyPreset('')">clear</button>
        </div>
        <p class="cc-muted" v-if="query">{{ query.count }} protein(s)</p>
        <GapTable v-if="query" :columns="explorerCols" :rows="query.rows" empty-message="No matches.">
          <template #links="{ row }"><CompassLinks :acc="row.uniprot_acc" /></template>
        </GapTable>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiGet } from '../api'
import { COMPASS_BASE } from '../config'
import CompassProteinCard from '../components/CompassProteinCard.vue'
import CompassLinks from '../components/CompassLinks.vue'
import GapTable from '../components/GapTable.vue'

const route = useRoute()
const router = useRouter()

// Single source of truth for the view modes: drives the toggle buttons AND the
// set of accepted `?mode=` values (no duplicated magic strings).
const MODES = [
  { id: 'protein', label: 'Protein' },
  { id: 'proteomes', label: 'Proteomes' },
  { id: 'gaps', label: 'Gap Finder' },
  { id: 'explore', label: 'Explorer' },
]
const VALID_MODES = MODES.map((m) => m.id)

const mode = ref('protein')
const DEFAULT_ORGANISM = 'homo-sapiens'
const organism = ref(DEFAULT_ORGANISM)

// Loading / error state for the async views (proteomes, gaps, explorer) so an in-flight
// load shows a spinner and a backend failure shows a retry banner — never a fake-empty table.
const loading = ref(false)
const loadErr = ref('')

// --- Proteomes scoreboard (cross-species completeness) ---
const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
const proteomes = ref([])
const orgFilter = ref('')
const sortKey = ref('reanalysis_headroom')
const sortDir = ref(-1)   // default: most headroom first

async function loadProteomes() {
  if (proteomes.value.length) return
  try { proteomes.value = (await apiGet(COMPASS_BASE, '/organisms')).organisms || [] }
  catch (e) { proteomes.value = []; loadErr.value = 'Could not load the proteomes scoreboard.'; throw e }
}
function sortBy(key) {
  if (sortKey.value === key) { sortDir.value *= -1 } else { sortKey.value = key; sortDir.value = -1 }
}
// aria-sort state for a sortable column header.
function ariaSort(key) {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 1 ? 'ascending' : 'descending'
}
const filteredProteomes = computed(() => {
  const q = orgFilter.value.trim().toLowerCase()
  let rows = proteomes.value
  if (q) rows = rows.filter(r => `${r.common_name} ${r.organism} ${r.kingdom}`.toLowerCase().includes(q))
  const k = sortKey.value, d = sortDir.value
  return [...rows].sort((a, b) => {
    const av = a[k], bv = b[k]
    if (av == null) return 1
    if (bv == null) return -1
    return av > bv ? d : av < bv ? -d : 0
  })
})
function tierWidth(r, t) {
  const total = TIERS.reduce((s, x) => s + (r.by_tier[x] || 0), 0) || 1
  return { width: ((r.by_tier[t] || 0) / total * 100) + '%' }
}
function openOrganism(r) {
  organism.value = r.organism
  mode.value = 'gaps'
}

const acc = ref('')
const profile = ref(null)
const profileErr = ref('')
async function lookup() {
  if (!acc.value.trim()) return
  profileErr.value = ''
  try {
    profile.value = await apiGet(COMPASS_BASE, `/profile/${acc.value.trim().toUpperCase()}`)
    if (!profile.value || !profile.value.uniprot_acc) profileErr.value = 'No record for that accession.'
    syncUrl()   // reflect the looked-up accession into the URL (shareable ?acc=)
  } catch (e) { profileErr.value = 'Lookup failed.' }
}

const summary = ref(null)
const targets = ref([])
const peUps = ref([])
const unobserved = ref([])
// Does this organism have a PeptideAtlas build? Drives the empty-state copy for the
// PA-derived gap tables. Prefers the explicit `has_peptideatlas` flag; falls back to the
// coverage number for manifests built before that flag existed (null/0 -> no build).
const hasPA = computed(() => {
  const s = summary.value
  if (!s) return false
  if (typeof s.has_peptideatlas === 'boolean') return s.has_peptideatlas
  return (s.pct_swissprot_covered_pa || 0) > 0
})
async function loadGaps() {
  const org = organism.value
  summary.value = null; targets.value = []; peUps.value = []; unobserved.value = []
  try {
    // Four independent calls in parallel (latency = slowest, not the sum). The
    // swissprot_gap query is the reanalysis headroom itemized (PeptideAtlas-independent),
    // so every organism gets an actionable gap list.
    const [s, t, p, u] = await Promise.all([
      apiGet(COMPASS_BASE, '/gaps/summary', { organism: org }),
      apiGet(COMPASS_BASE, '/gaps/reanalysis-targets', { organism: org, limit: 100 }),
      apiGet(COMPASS_BASE, '/gaps/pe-upgrades', { organism: org, limit: 100 }),
      apiGet(COMPASS_BASE, '/query/facet', { organism: org, preset: 'swissprot_gap', sort: 'uniprot_pe', limit: 100 }),
    ])
    if (organism.value !== org) return   // a newer organism switch won this race — drop this response
    summary.value = s
    targets.value = t.rows || []
    peUps.value = p.rows || []
    unobserved.value = u.rows || []
  } catch (e) { loadErr.value = 'Could not load gaps for this organism.'; throw e }
}

const presets = [
  { id: 'pa_not_quantms', label: 'In PA, not quantms (T4)' },
  { id: 'quantms_not_pa', label: 'In quantms, not PA (T3)' },
  { id: 'pe_upgrade', label: 'PE-upgrade candidates (T2)' },
  { id: 'dark', label: 'Dark proteins (T6)' },
]
const preset = ref('')
const query = ref(null)
const facets = ref({})
async function loadFacets() { try { facets.value = (await apiGet(COMPASS_BASE, '/facets')).facets || {} } catch (e) { /* facets optional */ } }
function applyPreset(id) { preset.value = id }
async function runQuery() {
  try { query.value = await apiGet(COMPASS_BASE, '/query/facet', { preset: preset.value || undefined, limit: 200 }) }
  catch (e) { query.value = { rows: [], count: 0 }; loadErr.value = 'Query failed.'; throw e }
}

function pct(v) { return v == null ? '—' : `${Number(v).toFixed(1)}%` }
function fmt(v) { return v == null ? '—' : Number(v).toLocaleString() }

// Column configs for the gap/explorer tables (rendered by <GapTable>). The
// `links` column is filled by a named slot that renders <CompassLinks>.
const unobservedCols = [
  { key: 'uniprot_acc', label: 'Accession' },
  { key: 'links', label: 'Links' },
  { key: 'gene', label: 'Gene' },
  { key: 'uniprot_pe', label: 'PE', render: (r) => `PE${r.uniprot_pe}` },
  { key: 'evidence_tier', label: 'Tier' },
]
const targetsCols = [
  { key: 'uniprot_acc', label: 'Accession' },
  { key: 'links', label: 'Links' },
  { key: 'gene', label: 'Gene' },
  { key: 'pa_presence_level', label: 'PA level' },
  { key: 'pa_n_samples', label: 'PA samples' },
  { key: 'pa_n_tissues', label: 'Tissues' },
]
const peUpsCols = [
  { key: 'uniprot_acc', label: 'Accession' },
  { key: 'links', label: 'Links' },
  { key: 'gene', label: 'Gene' },
  { key: 'uniprot_pe', label: 'PE', render: (r) => `PE${r.uniprot_pe}` },
  { key: 'n_unique_peptides', label: 'Unique peptides' },
  { key: 'n_datasets', label: 'Datasets' },
]
const explorerCols = [
  { key: 'uniprot_acc', label: 'Accession' },
  { key: 'links', label: 'Links' },
  { key: 'gene', label: 'Gene' },
  { key: 'evidence_tier', label: 'Tier' },
  { key: 'uniprot_pe', label: 'PE', render: (r) => `PE${r.uniprot_pe}` },
  { key: 'quantms_observed', label: 'quantms', render: (r) => (r.quantms_observed ? '✓' : '') },
  { key: 'pa_observed', label: 'PeptideAtlas', render: (r) => (r.pa_observed ? (r.pa_presence_level || '✓') : '') },
]
// PA-derived tables get a different empty state depending on whether this
// organism has a PeptideAtlas build.
const targetsEmpty = computed(() => hasPA.value
  ? 'None.'
  : 'No PeptideAtlas build for this organism — reanalysis targets are PeptideAtlas-derived (currently human-only).')
const peUpsEmpty = computed(() => hasPA.value
  ? 'None.'
  : 'Needs PeptideAtlas + HPP evidence (MS-confirmed, PE-upgradeable) — currently human-only.')

// --- Deep-linkable URLs -------------------------------------------------------
// Every Compass view reflects its state in the query string so pages can be
// shared/bookmarked and browser back/forward works. The URL is the source of
// truth: state changes rewrite it (router.replace, no history spam), and any URL
// change (link, bookmark, back/forward) repopulates state + loads the data.
//   /apps/compass?mode=proteomes
//   /apps/compass?mode=gaps&organism=homo-sapiens
//   /apps/compass?mode=protein&acc=P04637
//   /apps/compass?mode=explore&preset=dark
function currentQuery() {
  const q = { mode: mode.value }
  // organism is meaningful only for the Gap Finder (the scoreboard is cross-organism).
  if (mode.value === 'gaps' && organism.value) q.organism = organism.value
  if (mode.value === 'protein') { const a = acc.value.trim(); if (a) q.acc = a.toUpperCase() }
  if (mode.value === 'explore' && preset.value) q.preset = preset.value
  return q
}
function applyQuery(q) {
  mode.value = VALID_MODES.includes(q.mode) ? q.mode : 'protein'
  // Reset organism to the default when the URL omits it — mirrors acc/preset, so
  // navigating (or back/forward) to a URL without organism doesn't leak the previous one.
  organism.value = q.organism ? String(q.organism) : DEFAULT_ORGANISM
  acc.value = q.acc ? String(q.acc) : ''
  preset.value = q.preset ? String(q.preset) : ''
}
async function loadForMode() {
  loadErr.value = ''
  loading.value = true
  try {
    if (mode.value === 'proteomes') await loadProteomes()
    else if (mode.value === 'gaps') await loadGaps()
    else if (mode.value === 'explore') { await loadFacets(); await runQuery() }
    else if (mode.value === 'protein') {
      if (acc.value.trim()) await lookup()
      else { profile.value = null; profileErr.value = '' }  // no acc -> don't show a stale card
    }
  } catch (e) { /* loadErr already set by the failing loader */ }
  finally { loading.value = false }
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
// state -> URL (acc is written by lookup(); mode/organism/preset are structural)
watch([mode, organism, preset], syncUrl)
// URL -> state + data (shared link, bookmark, back/forward)
watch(() => route.query, (q) => { applyQuery(q); loadForMode() })
onMounted(() => { applyQuery(route.query); loadForMode(); syncUrl() })
</script>

<style scoped>
.mode-toggle { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.mode-toggle button { padding: 6px 14px; border: 1px solid var(--border, #e2e5ea); border-radius: 8px; background: #fff; cursor: pointer; }
.mode-toggle button.active { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; font-weight: 600; }
.cc-loading { color: var(--muted, #6b7280); padding: 8px 0; }
.cc-err { color: #b91c1c; padding: 8px 0; }
.cc-retry { margin-left: 8px; padding: 3px 12px; border: 1px solid #fca5a5; border-radius: 6px; background: #fff; color: #b91c1c; cursor: pointer; font-size: 13px; }
.filter-bar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
.filter-search { padding: 8px 12px; border: 1px solid var(--border, #e2e5ea); border-radius: 8px; }
.btn { padding: 8px 16px; border: none; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; font-weight: 600; }
.cc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.cc-metric { border: 1px solid var(--border, #e2e5ea); border-radius: 10px; padding: 16px; text-align: center; }
.m-val { font-size: 26px; font-weight: 700; color: #3730a3; } .m-lab { font-size: 13px; color: var(--muted, #6b7280); margin-top: 4px; }
.cc-h3 { margin: 20px 0 8px; } .cc-h3 small { color: var(--muted, #6b7280); font-weight: 400; }
.cc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.cc-table th, .cc-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border, #eef0f3); }
.cc-table th { color: var(--muted, #6b7280); font-weight: 600; }
.cc-muted { color: #9ca3af; }
.cc-metric small { color: var(--muted, #6b7280); font-weight: 400; font-size: 11px; }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: #4f46e5; }
.sortable:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.org-row { cursor: pointer; }
.org-row:hover { background: #f8fafc; }
.org-row:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; }
.tierbar { display: inline-flex; width: 90px; height: 10px; border-radius: 3px; overflow: hidden; }
.tseg { display: inline-block; height: 100%; }
.tier-T1 { background: #16a34a; } .tier-T2 { background: #65a30d; } .tier-T3 { background: #0891b2; }
.tier-T4 { background: #d97706; } .tier-T5 { background: #a3a3a3; } .tier-T6 { background: #e5e7eb; }
.cc-presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.chip { padding: 4px 12px; border: 1px solid var(--border, #e2e5ea); border-radius: 999px; background: #fff; cursor: pointer; font-size: 13px; }
.chip.active { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; font-weight: 600; }
.chip.clear { color: #9ca3af; }

/* Wide tables (up to 8 columns) must not push the page body into horizontal scroll on
   small screens — let each table scroll inside itself instead. */
@media (max-width: 768px) {
  .cc-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .cc-table th, .cc-table td { white-space: nowrap; }
  .filter-bar { flex-wrap: wrap; }
}
</style>
