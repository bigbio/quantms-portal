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
        <button type="button" :class="{ active: mode === 'gaps' }" @click="mode = 'gaps'; loadGaps()">Gap Finder</button>
        <button type="button" :class="{ active: mode === 'explore' }" @click="mode = 'explore'; loadFacets()">Explorer</button>
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

        <h3 class="cc-h3">Reanalysis targets <small>— PeptideAtlas observes them, quantms doesn't (ranked)</small></h3>
        <table class="cc-table"><thead><tr><th>Accession</th><th>Links</th><th>Gene</th><th>PA level</th><th>PA samples</th><th>Tissues</th></tr></thead>
          <tbody><tr v-for="r in targets" :key="r.uniprot_acc"><td>{{ r.uniprot_acc }}</td><td><span v-html="links(r.uniprot_acc)"></span></td><td>{{ r.gene }}</td><td>{{ r.pa_presence_level }}</td><td>{{ r.pa_n_samples }}</td><td>{{ r.pa_n_tissues }}</td></tr>
          <tr v-if="!targets.length"><td colspan="6" class="cc-muted">None.</td></tr></tbody></table>

        <h3 class="cc-h3">PE-upgrade candidates <small>— MS-confirmed, UniProt PE below 1 (HPP-framed)</small></h3>
        <table class="cc-table"><thead><tr><th>Accession</th><th>Links</th><th>Gene</th><th>PE</th><th>Unique peptides</th><th>Datasets</th></tr></thead>
          <tbody><tr v-for="r in peUps" :key="r.uniprot_acc"><td>{{ r.uniprot_acc }}</td><td><span v-html="links(r.uniprot_acc)"></span></td><td>{{ r.gene }}</td><td>PE{{ r.uniprot_pe }}</td><td>{{ r.n_unique_peptides }}</td><td>{{ r.n_datasets }}</td></tr>
          <tr v-if="!peUps.length"><td colspan="6" class="cc-muted">None.</td></tr></tbody></table>
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
import { ref } from 'vue'
import { apiGet } from '../api'
import { COMPASS_BASE } from '../config'
import CompassProteinCard from '../components/CompassProteinCard.vue'

const mode = ref('protein')
const organism = ref('homo-sapiens')

const acc = ref('')
const profile = ref(null)
const profileErr = ref('')
async function lookup() {
  if (!acc.value.trim()) return
  profileErr.value = ''
  try {
    profile.value = await apiGet(COMPASS_BASE, `/profile/${acc.value.trim().toUpperCase()}`)
    if (!profile.value || !profile.value.uniprot_acc) profileErr.value = 'No record for that accession.'
  } catch (e) { profileErr.value = 'Lookup failed.' }
}

const summary = ref(null)
const targets = ref([])
const peUps = ref([])
async function loadGaps() {
  try {
    summary.value = await apiGet(COMPASS_BASE, '/gaps/summary', { organism: organism.value })
    targets.value = (await apiGet(COMPASS_BASE, '/gaps/reanalysis-targets', { organism: organism.value, limit: 100 })).rows || []
    peUps.value = (await apiGet(COMPASS_BASE, '/gaps/pe-upgrades', { organism: organism.value, limit: 100 })).rows || []
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
async function applyPreset(id) { preset.value = id; runQuery() }
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
.cc-presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.chip { padding: 4px 12px; border: 1px solid var(--border, #e2e5ea); border-radius: 999px; background: #fff; cursor: pointer; font-size: 13px; }
.chip.active { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; font-weight: 600; }
.chip.clear { color: #9ca3af; }
</style>
