<template>
  <!--
    Per-residue sequence coverage & intensity map for a protein.

    Best-effort, same posture as ProteinProfile: a slow/unavailable/absent
    /protein/coverage-map endpoint, {found:false}, or a missing sequence must
    NEVER break the page — it just renders nothing. A newer `accession` prop
    supersedes an in-flight fetch (reqId race guard).

    Each residue is a monospace cell whose green background opacity encodes the
    normalized (0..1) observation depth for that residue; uncovered residues are
    a neutral grey. PTM sites carry a small marker + accent underline. Rows of 50
    (grouped in 10s) with left/right position rulers; very long sequences are
    capped with a notice so the page can't hang.
  -->
  <div v-if="map" class="sm-panel">
    <div class="sm-head">
      <div class="sm-block-label">Sequence coverage &amp; intensity map</div>
      <div class="sm-legend" aria-hidden="true">
        <span class="sm-legend-item">
          <span class="sm-legend-label">Low</span>
          <span class="sm-legend-scale" />
          <span class="sm-legend-label">High</span>
          <span class="sm-legend-note">observation depth</span>
        </span>
        <span class="sm-legend-item">
          <span class="sm-legend-cell sm-has-ptm"><span class="sm-res">A</span></span>
          <span class="sm-legend-label">PTM site</span>
        </span>
      </div>
    </div>

    <div class="sm-scroll">
      <div class="sm-grid" :style="{ '--sm-cols': String(cols) }">
        <div v-for="row in rows" :key="row.start" class="sm-row">
          <span class="sm-ruler sm-ruler-l">{{ row.start }}</span>
          <span class="sm-cells">
            <template v-for="cell in row.cells" :key="cell.pos">
              <!-- spacer between blocks of 10 -->
              <span v-if="cell.blockBreak" class="sm-gap" aria-hidden="true" />
              <span
                class="sm-cell"
                :class="{ 'sm-has-ptm': cell.hasPtm, 'sm-covered': cell.intensity > 0 }"
                :style="cell.intensity > 0 ? { background: greenAt(cell.intensity) } : null"
                @mouseenter="showTip(cell, $event)"
                @mousemove="moveTip($event)"
                @mouseleave="hideTip"
              >
                <span class="sm-res">{{ cell.ch }}</span>
                <span v-if="cell.hasPtm" class="sm-dot" aria-hidden="true" />
              </span>
            </template>
          </span>
          <span class="sm-ruler sm-ruler-r">{{ row.end }}</span>
        </div>
      </div>
    </div>

    <div v-if="capped" class="sm-note">
      Showing the first {{ formatNum(shownLength) }} of {{ formatNum(fullLength) }} residues.
    </div>

    <!-- Floating tooltip (fixed-position, follows the cursor) -->
    <div v-if="tip" class="sm-tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
      <div class="sm-tip-head">
        <span class="sm-tip-res">{{ tip.ch }}</span>
        <span class="sm-tip-pos">position {{ formatNum(tip.pos) }}</span>
      </div>
      <div class="sm-tip-depth">
        <span class="sm-tip-bar">
          <span class="sm-tip-bar-fill" :style="{ width: Math.round(tip.intensity * 100) + '%' }" />
        </span>
        <span class="sm-tip-depth-val">{{ Math.round(tip.intensity * 100) }}% depth</span>
      </div>
      <div v-if="!tip.mods.length && tip.intensity === 0" class="sm-tip-empty">Not covered</div>
      <ul v-if="tip.mods.length" class="sm-tip-mods">
        <li v-for="m in tip.mods" :key="m.name">
          {{ m.name }}<span v-if="m.n_datasets" class="sm-tip-mod-n"> · {{ formatNum(m.n_datasets) }} datasets</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { apiGet } from '../api.js'
import { PEPTIDE_SEARCH_BASE } from '../config.js'
import { formatNum } from '../utils/format.js'

const props = defineProps({
  // Protein query: UniProt accession or gene. Empty clears the map.
  accession: { type: String, default: '' },
})

// Residues per row and block grouping.
const cols = 50
const BLOCK = 10
// Hard cap so a titin-scale sequence can never hang the render (a real
// minimap/virtualization is a noted design follow-up, out of scope for v1).
const MAX_RESIDUES = 3000

const map = ref(null)

// ptms[].pos is a 1-based absolute residue position (per the contract). Build a
// lookup so each residue cell can carry its modifications.
const ptmByPos = computed(() => {
  const out = new Map()
  const list = Array.isArray(map.value?.ptms) ? map.value.ptms : []
  for (const p of list) {
    const pos = Number(p?.pos)
    if (!Number.isFinite(pos)) continue
    out.set(pos, Array.isArray(p.mods) ? p.mods : [])
  }
  return out
})

const fullLength = computed(() => (map.value?.sequence || '').length)
const shownLength = computed(() => Math.min(fullLength.value, MAX_RESIDUES))
const capped = computed(() => fullLength.value > MAX_RESIDUES)

// Rows of `cols` residues, each split into blocks of BLOCK by a spacer cell.
const rows = computed(() => {
  const seq = map.value?.sequence || ''
  const intensity = Array.isArray(map.value?.intensity) ? map.value.intensity : []
  const n = shownLength.value
  const out = []
  for (let start = 0; start < n; start += cols) {
    const end = Math.min(start + cols, n)
    const cells = []
    for (let i = start; i < end; i++) {
      const pos = i + 1 // 1-based residue position
      const raw = Number(intensity[i])
      const val = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0
      const mods = ptmByPos.value.get(pos) || []
      cells.push({
        pos,
        ch: seq[i] || '',
        intensity: val,
        hasPtm: mods.length > 0,
        mods,
        // spacer before this cell when it starts a new block (but not the row).
        blockBreak: i !== start && (i % BLOCK === 0),
      })
    }
    out.push({ start: start + 1, end, cells })
  }
  return out
})

// Green background at a given normalized intensity. A gentle floor keeps the
// faintest covered residues visible; opacity scales up to full green.
function greenAt(t) {
  const a = 0.14 + 0.74 * Math.max(0, Math.min(1, t))
  return `rgba(16, 185, 129, ${a.toFixed(3)})` // --success (#10b981)
}

// --- Tooltip -----------------------------------------------------------------
const tip = ref(null)

function showTip(cell, ev) {
  tip.value = {
    pos: cell.pos,
    ch: cell.ch,
    intensity: cell.intensity,
    mods: cell.mods,
    x: 0,
    y: 0,
  }
  moveTip(ev)
}
function moveTip(ev) {
  if (!tip.value) return
  // Fixed positioning: offset from the cursor, nudged left/up near edges.
  const pad = 14
  let x = ev.clientX + pad
  let y = ev.clientY + pad
  const vw = window.innerWidth || 0
  if (x > vw - 220) x = ev.clientX - 220
  if (y > (window.innerHeight || 0) - 120) y = ev.clientY - 120
  tip.value.x = x
  tip.value.y = y
}
function hideTip() {
  tip.value = null
}

// --- Fetch (best-effort, race-guarded) ---------------------------------------
let reqId = 0
async function load(q) {
  hideTip()
  const query = (q || '').trim()
  if (!query) {
    map.value = null
    return
  }
  const myReq = ++reqId
  try {
    const data = await apiGet(PEPTIDE_SEARCH_BASE, '/protein/coverage-map', { accession: query })
    if (myReq !== reqId) return // a newer accession superseded this request
    // Only render when we actually got a usable sequence; anything else
    // (found:false, missing sequence) renders nothing.
    if (data && data.found && typeof data.sequence === 'string' && data.sequence.length) {
      map.value = data
    } else {
      map.value = null
    }
  } catch (e) {
    if (myReq !== reqId) return
    // Best-effort: the profile & dataset results below are the primary content.
    map.value = null
  }
}

watch(() => props.accession, (q) => load(q), { immediate: true })
</script>

<style scoped>
.sm-panel {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}
.sm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sm-block-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

/* --- Legend --------------------------------------------------------------- */
.sm-legend {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}
.sm-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sm-legend-label {
  font-size: 11px;
  color: var(--text-muted);
}
.sm-legend-note {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.8;
}
.sm-legend-scale {
  width: 84px;
  height: 10px;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    rgba(16, 185, 129, 0.14),
    rgba(16, 185, 129, 0.88)
  );
  border: 1px solid var(--border-subtle);
}

/* --- Grid ----------------------------------------------------------------- */
.sm-scroll {
  /* Wide sequence rows scroll INSIDE the panel; the page body never scrolls
     sideways. */
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
}
.sm-grid {
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1;
  /* enough for 50 residues + 4 block gaps + two rulers without wrapping */
  min-width: min-content;
}
.sm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
  white-space: nowrap;
}
.sm-ruler {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 40px;
}
.sm-ruler-l { text-align: right; }
.sm-ruler-r { text-align: left; }
.sm-cells {
  display: inline-flex;
  align-items: center;
}
.sm-gap {
  display: inline-block;
  width: 7px;
}
.sm-cell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 20px;
  border-radius: 2px;
  background: var(--bg-alt); /* neutral / uncovered */
  color: var(--text-secondary);
  cursor: default;
}
.sm-cell.sm-covered {
  color: var(--text-primary);
}
.sm-res {
  position: relative;
  z-index: 1;
}
.sm-cell.sm-has-ptm {
  box-shadow: inset 0 -2px 0 0 var(--violet);
  font-weight: 700;
}
.sm-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--violet);
  z-index: 2;
}
.sm-note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Legend PTM demo cell */
.sm-legend-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 20px;
  border-radius: 2px;
  font-family: var(--mono);
  font-size: 13px;
  background: rgba(16, 185, 129, 0.5);
  color: var(--text-primary);
}

/* --- Tooltip -------------------------------------------------------------- */
.sm-tip {
  position: fixed;
  z-index: 50;
  min-width: 150px;
  max-width: 240px;
  padding: 8px 10px;
  background: var(--text-primary);
  color: #fff;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.28);
  pointer-events: none;
}
.sm-tip-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}
.sm-tip-res {
  font-family: var(--mono);
  font-weight: 700;
  font-size: 14px;
}
.sm-tip-pos {
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}
.sm-tip-depth {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sm-tip-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.22);
  border-radius: 3px;
  overflow: hidden;
}
.sm-tip-bar-fill {
  display: block;
  height: 100%;
  background: var(--success);
  border-radius: 3px;
}
.sm-tip-depth-val {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  opacity: 0.9;
}
.sm-tip-empty {
  margin-top: 4px;
  opacity: 0.75;
}
.sm-tip-mods {
  list-style: none;
  margin: 6px 0 0;
  padding: 6px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}
.sm-tip-mods li {
  padding: 1px 0;
}
.sm-tip-mod-n {
  opacity: 0.75;
}
</style>
