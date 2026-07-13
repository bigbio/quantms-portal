<template>
  <!--
    Biological profile for a protein, shown above the per-dataset results.
    The protein-level mirror of PeptideProfile. Best-effort: a slow/unavailable
    /protein/profile endpoint must never break the page, so a failure just
    renders nothing. Unit labelling matches PeptideProfile exactly: chips are
    counted in datasets ("· datasets"); observation mini-bars are counted in
    observations / spectral matches ("· observations (spectral matches)").
  -->
  <div v-if="loading" class="pp-panel pp-quiet">
    <span class="pp-spinner" /> Building biological profile…
  </div>

  <!-- Ambiguous query: the backend could not resolve a single protein, but
       offers ranked candidates. Show a picker; clicking one re-runs the search
       for that exact accession. -->
  <div v-else-if="hasCandidates" class="pp-panel">
    <div class="pp-cand-head">
      Multiple proteins match <code class="pp-seq">{{ queryLabel }}</code> — select one:
    </div>
    <ul class="pp-cand-list">
      <li
        v-for="c in candidates"
        :key="c.accession"
        class="pp-cand"
        role="button"
        tabindex="0"
        :title="`Show profile for ${c.accession}`"
        @click="pick(c.accession)"
        @keyup.enter="pick(c.accession)"
        @keyup.space="pick(c.accession)"
      >
        <span class="pp-cand-ids">
          <span v-if="c.gene" class="pp-gene">{{ c.gene }}</span>
          <span class="pp-prot-name">{{ c.name || c.accession }}</span>
          <span class="pp-acc">{{ c.accession }}</span>
        </span>
        <span class="pp-cand-counts">
          <span class="pp-cand-count" :title="`${formatNum(c.n_datasets)} datasets`">
            {{ formatNum(c.n_datasets) }} <span class="pp-cand-unit">datasets</span>
          </span>
          <span class="pp-cand-count" :title="`${formatNum(c.n_observations)} observations`">
            {{ formatNum(c.n_observations) }} <span class="pp-cand-unit">obs.</span>
          </span>
        </span>
      </li>
    </ul>
  </div>

  <div v-else-if="notInCorpus" class="pp-panel pp-quiet">
    <div class="pp-empty-title">No biological profile</div>
    <div class="pp-empty-sub">
      <code class="pp-seq">{{ displayQuery }}</code> is not in the corpus, so no
      protein-level species / tissue / PTM context is available for it.
    </div>
  </div>

  <div v-else-if="profile" class="pp-panel">
    <!-- Header: gene, protein name, accession → UniProt -->
    <div class="pp-head">
      <div class="pp-head-main">
        <a
          class="pp-prot-title"
          :href="uniprotUrl"
          target="_blank"
          rel="noopener"
          :title="`Open ${primaryAccession} on UniProt`"
        >
          <span v-if="profile.gene" class="pp-gene">{{ profile.gene }}</span>
          <span class="pp-prot-name">{{ profile.name || primaryAccession }}</span>
          <span class="pp-acc">{{ primaryAccession }} ↗</span>
        </a>
        <span v-if="profile.length" class="pp-len">{{ formatNum(profile.length) }} aa</span>
      </div>
      <div v-if="hasCoverage" class="pp-coverage" :title="`${coveragePct}% sequence coverage`">
        <span class="pp-cov-track">
          <span class="pp-cov-fill" :style="{ width: `${coveragePct}%` }" />
        </span>
        <span class="pp-cov-val">{{ coveragePct }}% coverage</span>
      </div>
    </div>

    <!-- Stats row -->
    <div class="pp-stats">
      <div class="pp-stat">
        <div class="pp-stat-val">{{ formatNum(profile.n_datasets) }}</div>
        <div class="pp-stat-label">Datasets</div>
      </div>
      <div class="pp-stat">
        <div class="pp-stat-val">{{ formatNum(profile.n_peptides) }}</div>
        <div class="pp-stat-label">Peptides</div>
      </div>
      <div class="pp-stat">
        <div class="pp-stat-val">{{ formatNum(profile.n_proteotypic_peptides) }}</div>
        <div class="pp-stat-label">Proteotypic peptides</div>
      </div>
      <div class="pp-stat">
        <div class="pp-stat-val">{{ formatBig(profile.n_observations) }}</div>
        <div class="pp-stat-label">Observations</div>
      </div>
      <div v-if="obsLevel" class="pp-stat">
        <div class="pp-stat-val">
          <button
            v-if="canPopover"
            ref="chipBtn"
            type="button"
            class="pp-level pp-level-btn"
            :class="levelClass"
            :aria-expanded="open"
            aria-haspopup="dialog"
            :title="`Where ${primaryAccession} sits across the corpus`"
            @click="togglePop"
          >
            {{ obsLevel }}
            <svg class="pp-level-ic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
              <line x1="5" y1="20" x2="5" y2="13" /><line x1="12" y1="20" x2="12" y2="7" /><line x1="19" y1="20" x2="19" y2="11" />
            </svg>
          </button>
          <span v-else class="pp-level" :class="levelClass">{{ obsLevel }}</span>
        </div>
        <div class="pp-stat-label">In this corpus</div>
      </div>
    </div>

    <!-- "Where does this protein sit" distribution popover: a mini histogram of
         the corpus-wide per-protein observation counts, with the three level
         bands colour-coded and a red "you are here" marker at this protein's
         total. Fixed-positioned + clamped; closes on outside-click/Escape/protein
         change. Only rendered when the distribution + this protein's percentile
         are available (canPopover). -->
    <div
      v-if="open && canPopover"
      ref="popEl"
      class="pp-obs-pop"
      role="dialog"
      aria-label="Observation distribution across the corpus"
      :style="{ left: pop.x + 'px', top: pop.y + 'px', width: pop.width + 'px' }"
    >
      <div class="pp-obs-pop-head">
        <span class="pp-obs-pop-title">Where this protein sits</span>
        <button type="button" class="pp-obs-close" aria-label="Close" @click="closePop">×</button>
      </div>

      <div class="pp-obs-plot">
        <div class="pp-obs-bars">
          <span
            v-for="(b, i) in bins"
            :key="i"
            class="pp-obs-bar"
            :class="'pp-obs-band-' + bandOf(b.lo)"
            :style="{ height: barHeight(b.count) }"
            :title="`${formatBig(Math.round(b.lo))}–${formatBig(Math.round(b.hi))} obs · ${formatNum(b.count)} proteins`"
          />
          <span
            v-if="markerLeft != null"
            class="pp-obs-marker"
            :style="{ left: markerLeft + '%' }"
            :title="`This protein · ${formatNum(obsTotal)} observations`"
          >
            <span class="pp-obs-marker-dot" />
          </span>
        </div>
        <div class="pp-obs-axis">
          <span>{{ formatBig(axisMin) }}</span>
          <span class="pp-obs-axis-mid">fewer ← observations → more</span>
          <span>{{ formatBig(axisMax) }}</span>
        </div>
      </div>

      <div class="pp-obs-legend" aria-hidden="true">
        <span class="pp-obs-key"><span class="pp-obs-sw pp-obs-band-rare" />Rare</span>
        <span class="pp-obs-key"><span class="pp-obs-sw pp-obs-band-occasional" />Occasional</span>
        <span class="pp-obs-key"><span class="pp-obs-sw pp-obs-band-frequent" />Frequent</span>
        <span class="pp-obs-key"><span class="pp-obs-sw pp-obs-sw-you" />This protein</span>
      </div>

      <div class="pp-obs-cap">
        <span class="pp-level" :class="levelClass">{{ obsLevel }}</span>
        <span v-if="percentile != null" class="pp-obs-cap-txt">
          — more observed than <strong>{{ percentile }}%</strong> of proteins
        </span>
      </div>
      <div class="pp-obs-sub">n = {{ formatNum(distN) }} proteins</div>
    </div>

    <!-- Per-residue sequence coverage & intensity map — the visual extension of the
         coverage %, shown right after the stats. Best-effort: renders nothing when
         its endpoint has no sequence for this accession. -->
    <ProteinSequenceMap :accession="primaryAccession" />

    <!-- Species / tissue / disease chips, sorted by observations; top 10 shown,
         the tail collapsed behind a toggle. -->
    <div v-if="observedContext.length" class="pp-block">
      <div class="pp-block-label">Observed context <span class="pp-unit">· datasets</span></div>
      <div class="pp-chips">
        <span v-for="c in shownContext" :key="c.key" class="tag pp-count-chip" :class="c.tagClass"
              :title="`${formatNum(c.n_datasets)} datasets · ${formatNum(c.n_observations)} observations`">
          <template v-if="c.icon">{{ c.icon }} </template>{{ c.value }}
          <span class="pp-count">{{ formatNum(c.n_datasets) }}</span>
        </span>
        <button v-if="hiddenContextCount > 0" type="button" class="tag pp-ptm-more"
                :aria-expanded="contextExpanded" @click="contextExpanded = !contextExpanded">
          {{ contextExpanded ? 'Show less' : `+ ${hiddenContextCount} more` }}
        </button>
      </div>
    </div>

    <!-- PTM sites: ordered by biological relevance; biology shown first, the
         prep-chemistry tail collapsed behind a toggle. -->
    <div v-if="ptms.length" class="pp-block">
      <div class="pp-block-label">Known PTM sites</div>
      <div class="pp-chips">
        <span
          v-for="m in shownPtms"
          :key="m.site"
          class="tag tag-violet pp-count-chip"
          :title="ptmTitle(m)"
        >
          {{ m.site }} <span class="pp-count">×{{ formatNum(m.n_datasets) }}</span>
          <span
            v-if="ptmClassInfo(m.class)"
            class="ptm-badge"
            :class="ptmClassInfo(m.class).tagClass"
          >{{ ptmClassInfo(m.class).label }}</span>
        </span>
        <button
          v-if="hiddenPtmCount > 0"
          type="button"
          class="tag pp-ptm-more"
          :aria-expanded="ptmsExpanded"
          @click="ptmsExpanded = !ptmsExpanded"
        >
          {{ ptmsExpanded ? 'Show less' : `+ ${hiddenPtmCount} more` }}
        </button>
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
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { apiGet } from '../api.js'
import { PEPTIDE_SEARCH_BASE } from '../config.js'
import { formatNum, formatBig, ptmClassInfo, orderPtms, isBiologicalPtm } from '../utils/format.js'
import ProteinSequenceMap from './ProteinSequenceMap.vue'

// Corpus-wide observation distribution (identical for every protein): fetched
// ONCE from /stats and cached at module scope, so switching proteins never
// refetches. Stays null when unavailable (index not ready / old backend) — the
// observation-level chip then degrades to a plain, non-interactive chip.
const obsDistribution = ref(null)
let obsDistSettled = false
let obsDistPromise = null
async function ensureObsDistribution() {
  if (obsDistSettled) return
  if (obsDistPromise) return obsDistPromise
  obsDistPromise = (async () => {
    try {
      const data = await apiGet(PEPTIDE_SEARCH_BASE, '/stats')
      const dist = data?.obs_distribution
      if (dist && Array.isArray(dist.bins) && dist.bins.length) {
        obsDistribution.value = dist
      }
    } catch (e) {
      // Best-effort: no distribution → the chip stays a plain chip. Never throw.
    } finally {
      obsDistSettled = true
    }
  })()
  return obsDistPromise
}

const props = defineProps({
  // Protein query: UniProt accession or gene. Empty string clears the panel.
  accession: { type: String, default: '' },
})

// Chip tooltip: keep the observation count, append the biological-relevance class
// when the backend provides one.
function ptmTitle(m) {
  const obs = `${formatNum(m.n_observations)} observations`
  const info = ptmClassInfo(m.class)
  return info ? `${obs} · ${info.label}` : obs
}

// Emitted when the user picks a candidate from the "did you mean" list: the
// parent re-runs the protein search/profile for that exact accession.
const emit = defineEmits(['pick'])

const profile = ref(null)
const loading = ref(false)

function arr(v) {
  return Array.isArray(v) ? v : []
}

// Ranked "did you mean" candidates returned when the query is ambiguous or has
// no exact match (found === false with a candidate list).
const candidates = computed(() => arr(profile.value?.candidates))
// Ambiguous/no-exact-match query the backend could not resolve, but offers
// candidates for.
const hasCandidates = computed(
  () => !!(profile.value && profile.value.found === false && candidates.value.length)
)
// found === false with no candidates => protein absent from the corpus (a valid
// 200 response).
const notInCorpus = computed(
  () => !!(profile.value && profile.value.found === false && !candidates.value.length)
)

const displayQuery = computed(() => (props.accession || '').trim())
// Label for the "multiple proteins match" prompt: prefer the query the backend
// echoes back, fall back to the raw input.
const queryLabel = computed(() => profile.value?.query || displayQuery.value)

function pick(accession) {
  const acc = (accession || '').trim()
  if (acc) emit('pick', acc)
}

// The accession to display/link. Prefer the first resolved accession, then the
// raw query the backend echoes back.
const primaryAccession = computed(() =>
  arr(profile.value?.resolved_accessions)[0] || profile.value?.query || displayQuery.value
)
const uniprotUrl = computed(() =>
  profile.value?.uniprot_url || `https://www.uniprot.org/uniprotkb/${primaryAccession.value}`
)

// Sequence coverage: clamp to 0..100 and round for display.
const coveragePct = computed(() => {
  const v = Number(profile.value?.coverage_pct)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
})
const hasCoverage = computed(() => Number.isFinite(Number(profile.value?.coverage_pct)))

const species = computed(() => arr(profile.value?.species))
const tissues = computed(() => arr(profile.value?.tissues))
const diseases = computed(() => arr(profile.value?.diseases))
const ptms = computed(() => arr(profile.value?.ptms))

// Observed context: species + tissue + disease chips combined into one list,
// sorted by observation depth (desc), color-coded by kind. Top 10 shown, the
// rest behind a "+ N more" toggle.
const CONTEXT_SHOWN = 10
const contextExpanded = ref(false)
const observedContext = computed(() => {
  const items = [
    ...species.value.map((s) => ({ ...s, key: 'sp-' + s.value, tagClass: 'tag-blue', icon: '🧬' })),
    ...tissues.value.map((t) => ({ ...t, key: 'ts-' + t.value, tagClass: 'tag-green', icon: '' })),
    ...diseases.value.map((d) => ({ ...d, key: 'ds-' + d.value, tagClass: 'tag-warning', icon: '' })),
  ]
  return items.sort((a, b) => (Number(b.n_observations) || 0) - (Number(a.n_observations) || 0))
})
const shownContext = computed(() =>
  contextExpanded.value ? observedContext.value : observedContext.value.slice(0, CONTEXT_SHOWN)
)
const hiddenContextCount = computed(() => Math.max(0, observedContext.value.length - CONTEXT_SHOWN))

// PTM display: order by biological relevance, show the leading biological group
// by default and tuck the prep-chemistry tail behind a "+ N more" toggle. When
// there is no biology to lead with, show the first few of the ordered list.
const PTM_FALLBACK_SHOWN = 5
const ptmsExpanded = ref(false)
const orderedPtms = computed(() => orderPtms(ptms.value))
const biologicalPtmCount = computed(
  () => orderedPtms.value.filter((m) => isBiologicalPtm(m)).length
)
// Default-visible count: the biological leading group, or the first N when none.
const ptmShownCount = computed(
  () => biologicalPtmCount.value || Math.min(PTM_FALLBACK_SHOWN, orderedPtms.value.length)
)
const shownPtms = computed(() =>
  ptmsExpanded.value ? orderedPtms.value : orderedPtms.value.slice(0, ptmShownCount.value)
)
const hiddenPtmCount = computed(() =>
  Math.max(0, orderedPtms.value.length - ptmShownCount.value)
)

const obsLevel = computed(() => profile.value?.observations?.level || '')
const levelClass = computed(() => {
  switch (obsLevel.value) {
    case 'frequent': return 'pp-level-frequent'
    case 'occasional': return 'pp-level-occasional'
    case 'rare': return 'pp-level-rare'
    default: return ''
  }
})

// --- "Where does this protein sit" distribution popover ----------------------
// This protein's own observation summary (gene-centric total + percentile).
const observations = computed(() => profile.value?.observations || null)
const obsTotal = computed(() => Number(observations.value?.total))
// Share of proteins observed no more than this one (0..100). null on old data.
const percentile = computed(() => {
  const p = observations.value?.percentile
  return p === null || p === undefined ? null : Number(p)
})

const bins = computed(() => arr(obsDistribution.value?.bins))
const distN = computed(() => {
  const n = Number(obsDistribution.value?.n)
  if (Number.isFinite(n) && n > 0) return n
  return bins.value.reduce((s, b) => s + (Number(b.count) || 0), 0)
})

// The chip is only interactive once the corpus distribution is loaded AND this
// protein carries a total + percentile. Otherwise it renders exactly as before.
const canPopover = computed(
  () =>
    bins.value.length > 0 &&
    Number.isFinite(obsTotal.value) &&
    percentile.value !== null &&
    Number.isFinite(percentile.value)
)

// Bar height ∝ sqrt(count) so rare (small-count) bins stay visible next to the
// tall mode. Returned as a percentage of the plot height.
const binMaxCount = computed(() => Math.max(1, ...bins.value.map((b) => Number(b.count) || 0)))
function barHeight(count) {
  const c = Math.max(0, Number(count) || 0)
  if (c <= 0) return '0%'
  const t = Math.sqrt(c) / Math.sqrt(binMaxCount.value)
  return Math.max(6, Math.round(t * 100)) + '%'
}

// Classify an observation-count value into one of the three level bands using
// the per-protein cutoffs. Cutoffs may be null (old data) → everything reads as
// the neutral 'rare' band, which still renders tastefully.
function bandOf(value) {
  const c = obsDistribution.value?.cutoffs || {}
  const occ = Number(c.occasional)
  const freq = Number(c.frequent)
  const v = Number(value)
  if (Number.isFinite(freq) && v >= freq) return 'frequent'
  if (Number.isFinite(occ) && v >= occ) return 'occasional'
  return 'rare'
}

// Left offset (0..100 %) of the "you are here" marker: locate the bin containing
// this protein's total, then interpolate within it. Equal-width bars, so each
// bin owns 1/n of the width.
const markerLeft = computed(() => {
  const bs = bins.value
  const total = obsTotal.value
  if (!bs.length || !Number.isFinite(total)) return null
  const n = bs.length
  if (total < Number(bs[0].lo)) return 0
  for (let i = 0; i < n; i++) {
    const lo = Number(bs[i].lo)
    const hi = Number(bs[i].hi)
    const inBin = total >= lo && (total < hi || i === n - 1)
    if (inBin) {
      let frac = 0.5
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
        frac = Math.max(0, Math.min(1, (total - lo) / (hi - lo)))
      }
      return ((i + frac) / n) * 100
    }
  }
  return 100
})

const axisMin = computed(() => Math.round(Number(bins.value[0]?.lo)))
const axisMax = computed(() => Math.round(Number(bins.value[bins.value.length - 1]?.hi)))

// Popover open/position state. Fixed-positioned + clamped to the viewport, and
// repositioned on scroll/resize so it stays anchored to its chip.
const open = ref(false)
const chipBtn = ref(null)
const popEl = ref(null)
const pop = ref({ x: 0, y: 0, width: 340 })

function positionPop() {
  const el = chipBtn.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth || 0
  const width = Math.min(340, Math.max(240, vw - 24))
  const margin = 12
  let x = r.left
  if (x + width > vw - margin) x = vw - width - margin
  if (x < margin) x = margin
  pop.value = { x, y: r.bottom + 8, width }
}
function togglePop() {
  if (!canPopover.value) return
  if (open.value) {
    open.value = false
    return
  }
  open.value = true
  nextTick(positionPop)
}
function closePop() {
  open.value = false
}
function onDocPointer(e) {
  if (!open.value) return
  const b = chipBtn.value
  const p = popEl.value
  if (b && b.contains(e.target)) return
  if (p && p.contains(e.target)) return
  closePop()
}
function onKey(e) {
  if (e.key === 'Escape' && open.value) closePop()
}
function onScrollResize() {
  if (open.value) positionPop()
}

onMounted(() => {
  ensureObsDistribution()
  document.addEventListener('mousedown', onDocPointer)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', onScrollResize)
  window.addEventListener('scroll', onScrollResize, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocPointer)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onScrollResize)
  window.removeEventListener('scroll', onScrollResize, true)
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
async function load(q) {
  const query = (q || '').trim()
  if (!query) {
    profile.value = null
    loading.value = false
    return
  }
  const myReq = ++reqId
  loading.value = true
  profile.value = null
  ptmsExpanded.value = false
  contextExpanded.value = false
  open.value = false // close the distribution popover when the protein changes
  try {
    const data = await apiGet(PEPTIDE_SEARCH_BASE, '/protein/profile', { accession: query })
    if (myReq !== reqId) return // a newer query superseded this request
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

watch(() => props.accession, (q) => load(q), { immediate: true })
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
.pp-prot-title {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  text-decoration: none;
}
.pp-prot-title:hover .pp-prot-name {
  text-decoration: underline;
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
.pp-gene {
  font-weight: 700;
  font-size: 16px;
  color: var(--indigo);
}
.pp-prot-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.pp-acc {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
}
.pp-coverage {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pp-cov-track {
  width: 120px;
  height: 8px;
  background: var(--border-subtle);
  border-radius: 4px;
  overflow: hidden;
}
.pp-cov-fill {
  display: block;
  height: 100%;
  background: var(--indigo);
  border-radius: 4px;
}
.pp-cov-val {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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

/* Interactive observation-level chip: reads like the plain level word, plus a
   small histogram glyph hinting it opens the distribution popover. */
.pp-level-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 6px 1px 4px;
  margin-left: -4px;
  font: inherit;
  font-size: 18px;
  line-height: 1.2;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.pp-level-btn:hover,
.pp-level-btn[aria-expanded='true'] {
  background: var(--bg-alt);
  border-color: var(--border);
}
.pp-level-btn:focus-visible {
  outline: 2px solid var(--indigo);
  outline-offset: 1px;
}
.pp-level-ic {
  opacity: 0.65;
}

/* --- Distribution popover ------------------------------------------------- */
.pp-obs-pop {
  position: fixed;
  z-index: 60;
  max-width: 92vw;
  padding: 12px 14px 11px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
}
.pp-obs-pop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.pp-obs-pop-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.pp-obs-close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.pp-obs-close:hover {
  color: var(--text-primary);
}
.pp-obs-bars {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 78px;
  padding-bottom: 1px;
  border-bottom: 1px solid var(--border);
}
.pp-obs-bar {
  flex: 1 1 0;
  min-width: 2px;
  border-radius: 2px 2px 0 0;
  transition: none;
}
.pp-obs-band-rare { background: var(--border); }
.pp-obs-band-occasional { background: var(--indigo-light); }
.pp-obs-band-frequent { background: var(--indigo); }
/* "you are here" marker: a full-height red line with a dot on top. */
.pp-obs-marker {
  position: absolute;
  top: -3px;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #ef4444;
  pointer-events: none;
}
.pp-obs-marker-dot {
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 0 2px var(--surface);
}
.pp-obs-axis {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-top: 5px;
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.pp-obs-axis-mid {
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.85;
}
.pp-obs-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 10px;
}
.pp-obs-key {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-secondary);
}
.pp-obs-sw {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.pp-obs-sw-you {
  background: #ef4444;
  border-radius: 50%;
}
.pp-obs-cap {
  margin-top: 11px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  font-size: 13px;
  color: var(--text-secondary);
}
.pp-obs-cap .pp-level {
  font-size: 13px;
}
.pp-obs-cap-txt strong {
  color: var(--text-primary);
}
.pp-obs-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
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
/* "+ N more" / "Show less" toggle for the collapsed PTM tail: a neutral,
   keyboard-operable chip that sits inline with the PTM chips. */
.pp-ptm-more {
  display: inline-flex;
  align-items: center;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.pp-ptm-more:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
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

/* --- "Did you mean" candidate picker ------------------------------------- */
.pp-cand-head {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
.pp-cand-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pp-cand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.pp-cand:hover,
.pp-cand:focus {
  border-color: var(--indigo);
  background: rgba(99, 102, 241, 0.06);
  outline: none;
}
.pp-cand-ids {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.pp-cand-counts {
  display: inline-flex;
  align-items: baseline;
  gap: 16px;
  white-space: nowrap;
}
.pp-cand-count {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.pp-cand-unit {
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
</style>
