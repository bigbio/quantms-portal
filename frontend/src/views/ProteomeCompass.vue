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

      <div class="mode-toggle">
        <button type="button" :class="{ active: mode === 'protein' }" @click="mode = 'protein'">Protein</button>
        <button type="button" :class="{ active: mode === 'proteomes' }" @click="mode = 'proteomes'">Proteomes</button>
        <button type="button" :class="{ active: mode === 'gaps' }" @click="mode = 'gaps'">Gap Finder</button>
        <button type="button" :class="{ active: mode === 'explore' }" @click="mode = 'explore'">Explorer</button>
      </div>

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
            <th @click="sortBy('common_name')" class="sortable">Organism</th>
            <th @click="sortBy('kingdom')" class="sortable">Kingdom</th>
            <th @click="sortBy('n_swissprot')" class="sortable num">Proteins (SP / full)</th>
            <th @click="sortBy('pct_swissprot_covered_quantms')" class="sortable num">quantms %</th>
            <th @click="sortBy('pct_swissprot_covered_pa')" class="sortable num">PeptideAtlas %</th>
            <th @click="sortBy('n_gpp_passing')" class="sortable num">GPP-passing</th>
            <th>Tiers</th>
            <th @click="sortBy('reanalysis_headroom')" class="sortable num">Headroom</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in filteredProteomes" :key="r.organism" class="org-row" @click="openOrganism(r)">
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
        <table class="cc-table"><thead><tr><th>Accession</th><th>Links</th><th>Gene</th><th>PE</th><th>Tier</th></tr></thead>
          <tbody><tr v-for="r in unobserved" :key="r.uniprot_acc"><td>{{ r.uniprot_acc }}</td><td><span v-html="links(r.uniprot_acc)"></span></td><td>{{ r.gene }}</td><td>PE{{ r.uniprot_pe }}</td><td>{{ r.evidence_tier }}</td></tr>
          <tr v-if="!unobserved.length"><td colspan="5" class="cc-muted">None — quantms already covers the full reviewed proteome for this organism.</td></tr></tbody></table>

        <h3 class="cc-h3">Reanalysis targets <small>— PeptideAtlas observes them, quantms doesn't (ranked)</small></h3>
        <table class="cc-table"><thead><tr><th>Accession</th><th>Links</th><th>Gene</th><th>PA level</th><th>PA samples</th><th>Tissues</th></tr></thead>
          <tbody><tr v-for="r in targets" :key="r.uniprot_acc"><td>{{ r.uniprot_acc }}</td><td><span v-html="links(r.uniprot_acc)"></span></td><td>{{ r.gene }}</td><td>{{ r.pa_presence_level }}</td><td>{{ r.pa_n_samples }}</td><td>{{ r.pa_n_tissues }}</td></tr>
          <tr v-if="!targets.length"><td colspan="6" class="cc-muted">{{ hasPA ? 'None.' : 'No PeptideAtlas build for this organism — reanalysis targets are PeptideAtlas-derived (currently human-only).' }}</td></tr></tbody></table>

        <h3 class="cc-h3">PE-upgrade candidates <small>— MS-confirmed, UniProt PE below 1 (HPP-framed)</small></h3>
        <table class="cc-table"><thead><tr><th>Accession</th><th>Links</th><th>Gene</th><th>PE</th><th>Unique peptides</th><th>Datasets</th></tr></thead>
          <tbody><tr v-for="r in peUps" :key="r.uniprot_acc"><td>{{ r.uniprot_acc }}</td><td><span v-html="links(r.uniprot_acc)"></span></td><td>{{ r.gene }}</td><td>PE{{ r.uniprot_pe }}</td><td>{{ r.n_unique_peptides }}</td><td>{{ r.n_datasets }}</td></tr>
          <tr v-if="!peUps.length"><td colspan="6" class="cc-muted">{{ hasPA ? 'None.' : 'Needs PeptideAtlas + HPP evidence (MS-confirmed, PE-upgradeable) — currently human-only.' }}</td></tr></tbody></table>
      </div>

      <!-- Explorer mode -->
      <div v-else>
        <div class="cc-presets">
          <span class="cc-muted">Set queries:</span>
          <button v-for="p in presets" :key="p.id" class="chip" :class="{ active: preset === p.id }" @click="applyPreset(p.id)">{{ p.label }}</button>
          <button v-if="preset" class="chip clear" @click="applyPreset('')">clear</button>
        </div>
        <p class="cc-muted" v-if="query">{{ query.count }} protein(s)</p>
        <table class="cc-table" v-if="query"><thead><tr><th>Accession</th><th>Links</th><th>Gene</th><th>Tier</th><th>PE</th><th>quantms</th><th>PeptideAtlas</th></tr></thead>
          <tbody><tr v-for="r in query.rows" :key="r.uniprot_acc"><td>{{ r.uniprot_acc }}</td><td><span v-html="links(r.uniprot_acc)"></span></td><td>{{ r.gene }}</td><td>{{ r.evidence_tier }}</td><td>PE{{ r.uniprot_pe }}</td><td>{{ r.quantms_observed ? '✓' : '' }}</td><td>{{ r.pa_observed ? (r.pa_presence_level || '✓') : '' }}</td></tr>
          <tr v-if="!query.rows.length"><td colspan="7" class="cc-muted">No matches.</td></tr></tbody></table>
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

const route = useRoute()
const router = useRouter()
let applyingRoute = false

const mode = ref('protein')
const organism = ref('homo-sapiens')

// --- Proteomes scoreboard (cross-species completeness) ---
const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
const proteomes = ref([])
const orgFilter = ref('')
const sortKey = ref('reanalysis_headroom')
const sortDir = ref(-1)   // default: most headroom first

async function loadProteomes() {
  if (proteomes.value.length) return
  try { proteomes.value = (await apiGet(COMPASS_BASE, '/organisms')).organisms || [] }
  catch (e) { proteomes.value = [] }
}
function sortBy(key) {
  if (sortKey.value === key) { sortDir.value *= -1 } else { sortKey.value = key; sortDir.value = -1 }
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
// PA-derived gap tables, which are inherently empty wherever PA has no build.
const hasPA = computed(() => !!(summary.value && (summary.value.pct_swissprot_covered_pa || 0) > 0))
async function loadGaps() {
  try {
    summary.value = await apiGet(COMPASS_BASE, '/gaps/summary', { organism: organism.value })
    targets.value = (await apiGet(COMPASS_BASE, '/gaps/reanalysis-targets', { organism: organism.value, limit: 100 })).rows || []
    peUps.value = (await apiGet(COMPASS_BASE, '/gaps/pe-upgrades', { organism: organism.value, limit: 100 })).rows || []
    // Reanalysis headroom, itemized — reviewed proteins quantms hasn't detected. This is
    // PeptideAtlas-independent, so every organism gets an actionable gap list (the T4/T2
    // tables above are empty wherever there is no PeptideAtlas build).
    unobserved.value = (await apiGet(COMPASS_BASE, '/query/facet',
      { organism: organism.value, preset: 'swissprot_gap', sort: 'uniprot_pe', limit: 100 })).rows || []
  } catch (e) { /* degraded: leave empty */ }
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
async function loadFacets() { try { facets.value = (await apiGet(COMPASS_BASE, '/facets')).facets || {} } catch (e) {} ; if (!query.value) runQuery() }
function applyPreset(id) { preset.value = id }
async function runQuery() {
  try { query.value = await apiGet(COMPASS_BASE, '/query/facet', { preset: preset.value || undefined, limit: 200 }) }
  catch (e) { query.value = { rows: [], count: 0 } }
}

function pct(v) { return v == null ? '—' : `${Number(v).toFixed(1)}%` }
function fmt(v) { return v == null ? '—' : Number(v).toLocaleString() }

// Per-accession cross-resource links (quantms peptide-search + PeptideAtlas + UniProt).
// Rendered via v-html; the accession is URL-encoded and never injected as raw markup.
function links(acc) {
  const a = encodeURIComponent(acc)
  const qms = `/apps/peptide-search?mode=protein&query=${a}`
  const pa = `https://db.systemsbiology.net/sbeams/cgi/PeptideAtlas/Search?action=GO&search_key=${a}&search_scope=Global`
  const up = `https://www.uniprot.org/uniprotkb/${a}/entry`
  return `<a href="${qms}" class="rlink">quantms</a> · `
    + `<a href="${pa}" target="_blank" rel="noopener" class="rlink">PA</a> · `
    + `<a href="${up}" target="_blank" rel="noopener" class="rlink">UniProt</a>`
}

// --- Deep-linkable URLs -------------------------------------------------------
// Every Compass view reflects its state in the query string so pages can be
// shared/bookmarked and browser back/forward works. The URL is the source of
// truth: state changes rewrite it (router.replace, no history spam), and any URL
// change (link, bookmark, back/forward) repopulates state + loads the data.
//   /apps/compass?mode=proteomes
//   /apps/compass?mode=gaps&organism=homo-sapiens
//   /apps/compass?mode=protein&acc=P04637
//   /apps/compass?mode=explore&preset=dark
const VALID_MODES = ['protein', 'proteomes', 'gaps', 'explore']
function currentQuery() {
  const q = { mode: mode.value }
  if ((mode.value === 'gaps' || mode.value === 'proteomes') && organism.value) q.organism = organism.value
  if (mode.value === 'protein') { const a = acc.value.trim(); if (a) q.acc = a.toUpperCase() }
  if (mode.value === 'explore' && preset.value) q.preset = preset.value
  return q
}
function applyQuery(q) {
  mode.value = VALID_MODES.includes(q.mode) ? q.mode : 'protein'
  if (q.organism) organism.value = String(q.organism)
  acc.value = q.acc ? String(q.acc) : ''
  preset.value = q.preset ? String(q.preset) : ''
}
function loadForMode() {
  if (mode.value === 'proteomes') loadProteomes()
  else if (mode.value === 'gaps') loadGaps()
  else if (mode.value === 'explore') { loadFacets(); runQuery() }
  else if (mode.value === 'protein') {
    if (acc.value.trim()) lookup()
    else { profile.value = null; profileErr.value = '' }  // no acc -> don't show a stale card
  }
}
function syncUrl() {
  if (applyingRoute) return
  router.replace({ query: currentQuery() }).catch(() => {})
}
// state -> URL (acc is written by lookup(); mode/organism/preset are structural)
watch([mode, organism, preset], syncUrl)
// URL -> state + data (shared link, bookmark, back/forward)
watch(() => route.query, (q) => { applyingRoute = true; applyQuery(q); loadForMode(); applyingRoute = false })
onMounted(() => { applyQuery(route.query); loadForMode(); syncUrl() })
</script>

<style scoped>
.mode-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
.mode-toggle button { padding: 6px 14px; border: 1px solid var(--border, #e2e5ea); border-radius: 8px; background: #fff; cursor: pointer; }
.mode-toggle button.active { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; font-weight: 600; }
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
.cc-table :deep(.rlink) { color: #4f46e5; text-decoration: none; font-weight: 600; }
.cc-table :deep(.rlink):hover { text-decoration: underline; }
.cc-metric small { color: var(--muted, #6b7280); font-weight: 400; font-size: 11px; }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: #4f46e5; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.org-row { cursor: pointer; }
.org-row:hover { background: #f8fafc; }
.tierbar { display: inline-flex; width: 90px; height: 10px; border-radius: 3px; overflow: hidden; }
.tseg { display: inline-block; height: 100%; }
.tier-T1 { background: #16a34a; } .tier-T2 { background: #65a30d; } .tier-T3 { background: #0891b2; }
.tier-T4 { background: #d97706; } .tier-T5 { background: #a3a3a3; } .tier-T6 { background: #e5e7eb; }
.cc-presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.chip { padding: 4px 12px; border: 1px solid var(--border, #e2e5ea); border-radius: 999px; background: #fff; cursor: pointer; font-size: 13px; }
.chip.active { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; font-weight: 600; }
.chip.clear { color: #9ca3af; }
</style>
