<template>
  <!--
    Biological profile for a bare peptide, shown above the per-dataset results.
    Best-effort: a slow/unavailable /peptide/profile endpoint must never break
    the page (same posture as the facets probe in PeptideSearch), so a failure
    just renders nothing.
  -->
  <div v-if="loading" class="pp-panel pp-quiet">
    <span class="pp-spinner" /> Building biological profile…
  </div>

  <div v-else-if="notInCorpus" class="pp-panel pp-quiet">
    <div class="pp-empty-title">No biological profile</div>
    <div class="pp-empty-sub">
      <code class="pp-seq">{{ displaySeq }}</code> is not in the corpus, so no
      species / tissue / PTM context is available for it.
    </div>
  </div>

  <div v-else-if="profile" class="pp-panel">
    <!-- Header: sequence, length, uniqueness -->
    <div class="pp-head">
      <div class="pp-head-main">
        <code class="pp-seq">{{ profile.sequence }}</code>
        <span class="pp-len">{{ profile.length }} aa</span>
      </div>
      <div class="pp-badges">
        <span v-if="uniqueness.proteotypic" class="pp-badge pp-badge-green" title="Maps to a single protein across the corpus">
          Proteotypic
        </span>
        <span v-if="uniqueness.gene_unique" class="pp-badge pp-badge-indigo" title="Maps to exactly one gene">
          Gene-unique
        </span>
      </div>
    </div>

    <!-- Stats row -->
    <div class="pp-stats">
      <div class="pp-stat">
        <div class="pp-stat-val">{{ formatNum(profile.n_datasets) }}</div>
        <div class="pp-stat-label">Datasets</div>
      </div>
      <div class="pp-stat">
        <div class="pp-stat-val">{{ formatNum(profile.n_peptidoforms) }}</div>
        <div class="pp-stat-label">Peptidoforms</div>
      </div>
      <div class="pp-stat">
        <div class="pp-stat-val">{{ formatBig(profile.n_observations) }}</div>
        <div class="pp-stat-label">Observations</div>
      </div>
      <div v-if="obsLevel" class="pp-stat">
        <div class="pp-stat-val">
          <span class="pp-level" :class="levelClass">{{ obsLevel }}</span>
        </div>
        <div class="pp-stat-label">In this corpus</div>
      </div>
    </div>

    <!-- Proteins -->
    <div v-if="proteins.length" class="pp-block">
      <div class="pp-block-label">Protein{{ proteins.length > 1 ? 's' : '' }}</div>
      <div class="pp-chips">
        <a
          v-for="p in proteins"
          :key="p.accession"
          class="pp-protein-chip"
          :href="p.uniprot_url || `https://www.uniprot.org/uniprotkb/${p.accession}`"
          target="_blank"
          rel="noopener"
          :title="`Open ${p.accession} on UniProt`"
        >
          <span v-if="p.gene" class="pp-gene">{{ p.gene }}</span>
          <span class="pp-prot-name">{{ p.name || p.accession }}</span>
          <span class="pp-acc">{{ p.accession }} ↗</span>
        </a>
      </div>
    </div>

    <!-- Species / tissue / disease chips with counts -->
    <div v-if="species.length || tissues.length || diseases.length" class="pp-block">
      <div class="pp-block-label">Observed context <span class="pp-unit">· datasets</span></div>
      <div class="pp-chips">
        <span v-for="s in species" :key="'sp-' + s.value" class="tag tag-blue pp-count-chip"
              :title="`${formatNum(s.n_datasets)} datasets`">
          🧬 {{ s.value }} <span class="pp-count">{{ formatNum(s.n_datasets) }}</span>
        </span>
        <span v-for="t in tissues" :key="'ts-' + t.value" class="tag tag-green pp-count-chip"
              :title="`${formatNum(t.n_datasets)} datasets`">
          {{ t.value }} <span class="pp-count">{{ formatNum(t.n_datasets) }}</span>
        </span>
        <span v-for="d in diseases" :key="'ds-' + d.value" class="tag tag-warning pp-count-chip"
              :title="`${formatNum(d.n_datasets)} datasets`">
          {{ d.value }} <span class="pp-count">{{ formatNum(d.n_datasets) }}</span>
        </span>
      </div>
    </div>

    <!-- PTM sites -->
    <div v-if="ptms.length" class="pp-block">
      <div class="pp-block-label">Known PTM sites</div>
      <div class="pp-chips">
        <span
          v-for="m in ptms"
          :key="m.site"
          class="tag tag-violet pp-count-chip"
          :title="`${formatNum(m.n_observations)} observations`"
        >
          {{ m.site }} <span class="pp-count">×{{ formatNum(m.n_datasets) }}</span>
        </span>
      </div>
    </div>

    <!-- Observation mini-bars -->
    <div v-if="topTissues.length || topSpecies.length" class="pp-block">
      <div class="pp-block-label">Where it is observed <span class="pp-unit">· observations (spectral matches)</span></div>
      <div class="pp-bars-grid">
        <div v-if="topTissues.length" class="pp-bars">
          <div class="pp-bars-cap">By tissue</div>
          <div v-for="row in topTissues" :key="'bt-' + row.value" class="pp-bar-row">
            <span class="pp-bar-label" :title="row.value">{{ row.value }}</span>
            <span class="pp-bar-track">
              <span class="pp-bar-fill pp-bar-green" :style="{ width: pct(row.n_observations, topTissueMax) }" />
            </span>
            <span class="pp-bar-val" :title="`${formatNum(row.n_observations)} observations`">{{ formatBig(row.n_observations) }}</span>
          </div>
        </div>
        <div v-if="topSpecies.length" class="pp-bars">
          <div class="pp-bars-cap">By species</div>
          <div v-for="row in topSpecies" :key="'bs-' + row.value" class="pp-bar-row">
            <span class="pp-bar-label" :title="row.value">{{ row.value }}</span>
            <span class="pp-bar-track">
              <span class="pp-bar-fill pp-bar-blue" :style="{ width: pct(row.n_observations, topSpeciesMax) }" />
            </span>
            <span class="pp-bar-val" :title="`${formatNum(row.n_observations)} observations`">{{ formatBig(row.n_observations) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary line -->
    <p v-if="profile.summary" class="pp-summary">{{ profile.summary }}</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { apiGet } from '../api.js'
import { PEPTIDE_SEARCH_BASE } from '../config.js'
import { formatNum, formatBig } from '../utils/format.js'

const props = defineProps({
  // Bare peptide sequence. Empty string clears the panel.
  sequence: { type: String, default: '' },
})

const profile = ref(null)
const loading = ref(false)

// found === false => peptide absent from the corpus (a valid 200 response).
const notInCorpus = computed(() => profile.value && profile.value.found === false)

const displaySeq = computed(() => (props.sequence || '').trim().toUpperCase())

function arr(v) {
  return Array.isArray(v) ? v : []
}

const uniqueness = computed(() => profile.value?.uniqueness || {})
const proteins = computed(() => arr(profile.value?.proteins))
const species = computed(() => arr(profile.value?.species))
const tissues = computed(() => arr(profile.value?.tissues))
const diseases = computed(() => arr(profile.value?.diseases))
const ptms = computed(() => arr(profile.value?.ptms))

const obsLevel = computed(() => profile.value?.observations?.level || '')
const levelClass = computed(() => {
  switch (obsLevel.value) {
    case 'frequent': return 'pp-level-frequent'
    case 'occasional': return 'pp-level-occasional'
    case 'rare': return 'pp-level-rare'
    default: return ''
  }
})

// Mini-bars: top few tissues/species by observation count.
const topTissues = computed(() => arr(profile.value?.observations?.by_tissue).slice(0, 5))
const topSpecies = computed(() => arr(profile.value?.observations?.by_species).slice(0, 5))
const topTissueMax = computed(() => Math.max(1, ...topTissues.value.map((r) => Number(r.n_observations) || 0)))
const topSpeciesMax = computed(() => Math.max(1, ...topSpecies.value.map((r) => Number(r.n_observations) || 0)))

function pct(v, max) {
  const p = Math.round((Number(v) || 0) / max * 100)
  // keep a visible sliver for non-zero values
  return `${Math.max(v ? 4 : 0, p)}%`
}

let reqId = 0
async function load(seq) {
  const bare = (seq || '').trim().toUpperCase()
  if (!bare) {
    profile.value = null
    loading.value = false
    return
  }
  const myReq = ++reqId
  loading.value = true
  profile.value = null
  try {
    const data = await apiGet(PEPTIDE_SEARCH_BASE, '/peptide/profile', { sequence: bare })
    if (myReq !== reqId) return // a newer sequence superseded this request
    profile.value = data
  } catch (e) {
    if (myReq !== reqId) return
    // Best-effort: never surface an error here — the dataset results below are
    // the primary content. Render nothing on failure.
    profile.value = null
  } finally {
    if (myReq === reqId) loading.value = false
  }
}

watch(() => props.sequence, (s) => load(s), { immediate: true })
</script>

<style scoped>
.pp-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px 24px;
  margin: 8px 0 20px;
}
.pp-quiet {
  color: var(--text-secondary);
  font-size: 14px;
}
.pp-empty-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.pp-empty-sub {
  font-size: 13px;
  color: var(--text-muted);
}
.pp-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border: 2px solid var(--border);
  border-top-color: var(--indigo);
  border-radius: 50%;
  vertical-align: middle;
  animation: pp-spin 0.7s linear infinite;
}
@keyframes pp-spin {
  to { transform: rotate(360deg); }
}
.pp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.pp-head-main {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.pp-seq {
  font-family: var(--mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}
.pp-len {
  font-size: 12px;
  color: var(--text-muted);
}
.pp-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pp-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  letter-spacing: 0.02em;
}
.pp-badge-green {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}
.pp-badge-indigo {
  background: rgba(99, 102, 241, 0.1);
  color: var(--indigo);
}
.pp-stats {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.pp-stat-val {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.pp-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.pp-level {
  text-transform: capitalize;
  font-size: 18px;
}
.pp-level-frequent { color: #059669; }
.pp-level-occasional { color: var(--indigo); }
.pp-level-rare { color: var(--text-secondary); }
.pp-block {
  margin-bottom: 16px;
}
.pp-block-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.pp-unit {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.75;
}
.pp-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pp-count-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.pp-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
  font-weight: 600;
}
.pp-protein-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-alt);
  text-decoration: none;
  font-size: 13px;
}
.pp-protein-chip:hover {
  border-color: var(--indigo);
}
.pp-gene {
  font-weight: 700;
  color: var(--indigo);
}
.pp-prot-name {
  color: var(--text-primary);
}
.pp-acc {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
}
.pp-bars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
}
.pp-bars-cap {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.pp-bar-row {
  display: grid;
  grid-template-columns: 110px 1fr 52px;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.pp-bar-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pp-bar-track {
  height: 8px;
  background: var(--border-subtle);
  border-radius: 4px;
  overflow: hidden;
}
.pp-bar-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
}
.pp-bar-green { background: var(--success); }
.pp-bar-blue { background: var(--blue); }
.pp-bar-val {
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pp-summary {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 820px;
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}
</style>
