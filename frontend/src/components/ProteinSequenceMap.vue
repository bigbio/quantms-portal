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
    (grouped in 10s) with left/right position rulers (absolute residue numbers).
    Only a WINDOW-sized slice renders at once so the page can't hang; proteins
    longer than the window get a navigation bar (prev/next + jump-to-range) plus
    a minimap. A PTM filter lets the user hide specific modification types.
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

    <p v-if="coverageSummary" class="sm-summary">
      {{ coverageSummary }}
    </p>

    <div v-if="ptmTypes.length" class="sm-ptm-filter">
      <span class="sm-ptm-filter-label">PTMs</span>
      <div class="sm-ptm-chips">
        <button
          v-for="t in ptmTypes"
          :key="t.name"
          type="button"
          class="sm-ptm-chip"
          :class="{ 'sm-ptm-off': hiddenPtms.has(t.name) }"
          :aria-pressed="!hiddenPtms.has(t.name)"
          @click="togglePtm(t.name)"
        >
          <span class="sm-ptm-name">{{ t.name }}</span>
          <span class="sm-ptm-count">{{ formatNum(t.count) }}</span>
          <span
            v-if="ptmClassInfo(t.class)"
            class="ptm-badge"
            :class="ptmClassInfo(t.class).tagClass"
          >{{ ptmClassInfo(t.class).label }}</span>
        </button>
      </div>
      <div class="sm-ptm-actions">
        <button type="button" class="sm-btn sm-btn-sm" @click="biologicalOnlyPtms">Biological only</button>
        <button type="button" class="sm-btn sm-btn-sm" @click="showAllPtms">Show all</button>
      </div>
    </div>

    <div v-if="hasNav" class="sm-nav">
      <div class="sm-nav-main">
        <span class="sm-nav-label">
          Residues {{ formatNum(windowStart + 1) }}–{{ formatNum(windowEnd) }} of {{ formatNum(fullLength) }}
        </span>
        <div class="sm-nav-btns">
          <button type="button" class="sm-btn" :disabled="atStart" @click="pagePrev">◀ Prev</button>
          <button type="button" class="sm-btn" :disabled="atEnd" @click="pageNext">Next ▶</button>
        </div>
        <form class="sm-nav-jump" @submit.prevent="doJump">
          <label class="sm-nav-jump-lbl">Go to</label>
          <input
            v-model="jumpFrom"
            class="sm-nav-input"
            type="number"
            min="1"
            :max="fullLength"
            placeholder="from"
            aria-label="Jump to residue (from)"
          />
          <span class="sm-nav-dash" aria-hidden="true">–</span>
          <input
            v-model="jumpTo"
            class="sm-nav-input"
            type="number"
            min="1"
            :max="fullLength"
            placeholder="to"
            aria-label="Jump to residue (to)"
          />
          <button type="submit" class="sm-btn">Go</button>
        </form>
      </div>
      <div class="sm-minimap" aria-hidden="true">
        <span class="sm-minimap-seg" :style="{ left: miniLeft, width: miniWidth }" />
      </div>
      <div v-if="jumpCapped" class="sm-note sm-nav-note">
        Requested range exceeds {{ formatNum(WINDOW) }} residues; showing the first {{ formatNum(WINDOW) }}.
      </div>
    </div>

    <div ref="scrollEl" class="sm-scroll">
      <div class="sm-grid" :style="{ '--sm-cols': String(cols) }">
        <div v-for="row in rows" :key="row.start" class="sm-row">
          <span class="sm-ruler sm-ruler-l">{{ row.start }}</span>
          <span class="sm-cells">
            <!-- eslint's vue/no-v-for-template-key is a false positive here; the
                 Vue 3 compiler REQUIRES the key on <template v-for>. -->
            <template v-for="cell in row.cells" :key="cell.pos">
              <!-- spacer between blocks of 10 -->
              <span v-if="cell.blockBreak" class="sm-gap" aria-hidden="true" />
              <span
                class="sm-cell"
                :class="{
                  'sm-has-ptm': cell.hasPtm,
                  'sm-covered': cell.intensity > 0,
                  'sm-has-term': !!cell.terminal,
                }"
                :style="cell.intensity > 0 ? { background: greenAt(cell.intensity) } : null"
                tabindex="0"
                role="img"
                :aria-label="cellLabel(cell)"
                @mouseenter="showTip(cell, $event)"
                @mousemove="moveTip($event)"
                @mouseleave="hideTip"
                @focus="showTipAtEl(cell, $event)"
                @blur="hideTip"
              >
                <span class="sm-res">{{ cell.ch }}</span>
                <span v-if="cell.hasPtm" class="sm-dot" aria-hidden="true" />
                <span
                  v-if="cell.terminal"
                  class="sm-term-badge"
                  :class="cell.terminal === 'N-term' ? 'sm-term-n' : 'sm-term-c'"
                  :title="cell.terminal === 'N-term' ? 'N-terminal modification' : 'C-terminal modification'"
                  >{{ cell.terminal === 'N-term' ? 'Nt' : 'Ct' }}</span
                >
              </span>
            </template>
          </span>
          <span class="sm-ruler sm-ruler-r">{{ row.end }}</span>
        </div>
      </div>
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
        <span class="sm-tip-depth-val">{{ formatNum(tip.depth) }} observations</span>
      </div>
      <div v-if="!tip.mods.length && tip.intensity === 0" class="sm-tip-empty">Not covered</div>
      <ul v-if="tip.mods.length" class="sm-tip-mods">
        <li v-for="m in tip.mods" :key="`${m.name}:${m.terminal || ''}`">
          <span v-if="m.terminal" class="sm-tip-term">{{ m.terminal === 'N-term' ? 'N-terminal' : 'C-terminal' }}</span
          >{{ m.terminal ? ' ' : '' }}{{ m.name }}<span v-if="m.n_datasets" class="sm-tip-mod-n"> · {{ formatNum(m.n_datasets) }} datasets</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { apiGet } from '../api.js'
import { PEPTIDE_SEARCH_BASE } from '../config.js'
import { formatNum, ptmClassInfo, orderPtms, isBiologicalPtm } from '../utils/format.js'

const props = defineProps({
  // Protein query: UniProt accession or gene. Empty clears the map.
  accession: { type: String, default: '' },
})

// Residues per row (responsive: fills the available width, see computeCols) and
// block grouping.
const cols = ref(50)
const BLOCK = 10
// Cell + amortized block-gap geometry (must track the .sm-cell / .sm-gap CSS).
const CELL_W = 15
const GAP_W = 7
const RULER_OVERHEAD = 104 // two rulers (~40px) + row gaps

// Container element (for width-driven responsive columns).
const scrollEl = ref(null)

// Pick the largest multiple of BLOCK residues per row that fits the panel width,
// so a wide screen shows more sequence per row instead of empty space on the
// right. Clamped so a narrow viewport keeps a readable row (and still scrolls).
function computeCols() {
  const el = scrollEl.value
  const avail = el && el.clientWidth
  if (!avail) return
  const per = CELL_W + GAP_W / BLOCK
  let n = Math.floor((avail - RULER_OVERHEAD) / per)
  n = Math.floor(n / BLOCK) * BLOCK
  cols.value = Math.max(50, Math.min(150, n))
}

let ro = null
onMounted(() => {
  computeCols()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => computeCols())
    if (scrollEl.value) ro.observe(scrollEl.value)
  }
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
})
// Window size: at most this many residues are rendered at once so a titin-scale
// sequence can never hang the render. Longer proteins get an interactive
// navigation bar (prev/next + jump-to-range) over the same in-memory data.
const WINDOW = 3000

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

// Accessible, plain-text coverage overview (also read by screen readers). Covers
// the whole protein, not just the visible window, so it summarizes the map that
// the per-residue cells present visually.
const coverageSummary = computed(() => {
  if (!map.value) return ''
  const len = fullLength.value
  if (!len) return ''
  const intensity = Array.isArray(map.value.intensity) ? map.value.intensity : []
  const depth = Array.isArray(map.value.depth) ? map.value.depth : []
  let covered = 0
  for (let i = 0; i < len; i++) {
    if (Number(intensity[i]) > 0 || Number(depth[i]) > 0) covered++
  }
  const pct = Math.round((covered / len) * 1000) / 10
  const ptmSites = Array.isArray(map.value.ptms) ? map.value.ptms.length : 0
  const ptmPart = ptmSites
    ? ` ${formatNum(ptmSites)} residue${ptmSites === 1 ? '' : 's'} carry modifications.`
    : ''
  return `Sequence coverage: ${formatNum(covered)} of ${formatNum(len)} residues observed (${pct}%).${ptmPart}`
})

// Per-cell accessible label so keyboard/AT users get the same information the
// pointer tooltip conveys (residue, position, depth, modifications).
function cellLabel(cell) {
  const parts = [`Residue ${cell.ch || '?'} at position ${cell.pos}`]
  if (cell.intensity > 0 || cell.depth > 0) {
    parts.push(`${formatNum(cell.depth)} observations`)
  } else {
    parts.push('not covered')
  }
  if (cell.mods && cell.mods.length) {
    const names = cell.mods
      .map((m) => (m.terminal ? `${m.terminal} ${m.name}` : m.name))
      .join(', ')
    parts.push(`modifications: ${names}`)
  }
  return parts.join('; ')
}

// --- Region navigation -------------------------------------------------------
// Only proteins longer than WINDOW get a nav bar; otherwise the whole sequence
// is the window. windowStart is 0-based; windowEnd is an exclusive residue index
// clamped to fullLength with windowEnd - windowStart <= WINDOW.
const windowStart = ref(0)
const windowEnd = ref(0)
const hasNav = computed(() => fullLength.value > WINDOW)
// Start of the last page when paging in WINDOW-sized steps from 0.
const lastPageStart = computed(
  () => Math.floor(Math.max(0, fullLength.value - 1) / WINDOW) * WINDOW
)
const atStart = computed(() => windowStart.value <= 0)
const atEnd = computed(() => windowStart.value >= lastPageStart.value)

// Position/size of the current window within the whole protein, for the minimap.
const miniLeft = computed(
  () => (fullLength.value ? (windowStart.value / fullLength.value) * 100 : 0) + '%'
)
const miniWidth = computed(() => {
  if (!fullLength.value) return '0%'
  const w = ((windowEnd.value - windowStart.value) / fullLength.value) * 100
  return Math.max(1, w) + '%'
})

// Set the visible window, clamping start/end to the sequence and capping the
// span to WINDOW residues.
function setWindow(start, end) {
  const n = fullLength.value
  const s = Math.max(0, Math.min(Math.floor(start), Math.max(0, n - 1)))
  let e = Math.max(s + 1, Math.min(Math.floor(end), n))
  if (e - s > WINDOW) e = s + WINDOW
  windowStart.value = s
  windowEnd.value = Math.min(e, n)
}
function pagePrev() {
  if (atStart.value) return
  jumpCapped.value = false
  const s = Math.max(0, windowStart.value - WINDOW)
  setWindow(s, s + WINDOW)
  hideTip()
}
function pageNext() {
  if (atEnd.value) return
  jumpCapped.value = false
  const s = Math.min(lastPageStart.value, windowStart.value + WINDOW)
  setWindow(s, s + WINDOW)
  hideTip()
}

// Jump-to-range: two 1-based inclusive inputs + Go. Invalid/empty input is
// ignored; from>to is swapped; spans wider than WINDOW render the first WINDOW.
const jumpFrom = ref('')
const jumpTo = ref('')
const jumpCapped = ref(false)
function doJump() {
  const n = fullLength.value
  if (!n) return
  let f = parseInt(jumpFrom.value, 10)
  let t = parseInt(jumpTo.value, 10)
  const fOk = Number.isFinite(f)
  const tOk = Number.isFinite(t)
  if (!fOk && !tOk) return // nothing usable entered
  if (!fOk) f = 1
  if (!tOk) t = n
  f = Math.max(1, Math.min(f, n))
  t = Math.max(1, Math.min(t, n))
  if (f > t) {
    const tmp = f
    f = t
    t = tmp
  }
  jumpCapped.value = t - f + 1 > WINDOW
  if (jumpCapped.value) t = f + WINDOW - 1
  setWindow(f - 1, t) // t is 1-based inclusive -> exclusive index === t
  hideTip()
}

// --- PTM visibility ----------------------------------------------------------
// Distinct PTM types across the WHOLE protein, each with a site count (a name is
// counted once per site). Ordered biological → artifact → label → fixed →
// unknown via the shared helper; each item keeps enough of a representative mod
// record for ptmClassInfo() to badge it.
const ptmTypes = computed(() => {
  const list = Array.isArray(map.value?.ptms) ? map.value.ptms : []
  const byName = new Map()
  for (const site of list) {
    const mods = Array.isArray(site?.mods) ? site.mods : []
    const seen = new Set()
    for (const m of mods) {
      const name = m?.name
      if (!name || seen.has(name)) continue // count each name once per site
      seen.add(name)
      let cur = byName.get(name)
      if (!cur) {
        cur = {
          name,
          count: 0,
          class: m.class,
          is_biological: m.is_biological,
          n_datasets: m.n_datasets,
          n_observations: m.n_observations,
        }
        byName.set(name, cur)
      }
      cur.count += 1
    }
  }
  return orderPtms(Array.from(byName.values()))
})

// Names of PTM types the user has hidden. Default: all shown.
const hiddenPtms = ref(new Set())
function togglePtm(name) {
  const s = new Set(hiddenPtms.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  hiddenPtms.value = s
}
function showAllPtms() {
  hiddenPtms.value = new Set()
}
function biologicalOnlyPtms() {
  const s = new Set()
  for (const t of ptmTypes.value) {
    if (!isBiologicalPtm(t)) s.add(t.name)
  }
  hiddenPtms.value = s
}

// Rows of `cols` residues, each split into blocks of BLOCK by a spacer cell.
// Only the current [windowStart, windowEnd) slice is rendered; positions stay
// absolute (1-based) so rulers and tooltips show real residue numbers.
const rows = computed(() => {
  const seq = map.value?.sequence || ''
  const intensity = Array.isArray(map.value?.intensity) ? map.value.intensity : []
  const depth = Array.isArray(map.value?.depth) ? map.value.depth : []
  const hidden = hiddenPtms.value
  const s0 = windowStart.value
  const e0 = Math.min(windowEnd.value, seq.length)
  const out = []
  const step = cols.value
  for (let start = s0; start < e0; start += step) {
    const end = Math.min(start + step, e0)
    const cells = []
    for (let i = start; i < end; i++) {
      const pos = i + 1 // 1-based residue position
      const raw = Number(intensity[i])
      const val = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0
      const obs = Number(depth[i])
      const allMods = ptmByPos.value.get(pos) || []
      // Only visible (non-hidden) mods drive the marker + tooltip list.
      const mods = hidden.size ? allMods.filter((m) => !hidden.has(m?.name)) : allMods
      // A terminal mod keeps its residue mark but is badged N-/C-term. Older
      // backends omit `terminal` entirely -> no badge (graceful degradation).
      const terminal = mods.find((m) => m?.terminal)?.terminal || null
      cells.push({
        pos,
        ch: seq[i] || '',
        intensity: val,
        depth: Number.isFinite(obs) ? obs : 0,
        hasPtm: mods.length > 0,
        terminal,
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
    depth: cell.depth,
    mods: cell.mods,
    x: 0,
    y: 0,
  }
  moveTip(ev)
}
// Keyboard focus mirror of showTip: anchor the tooltip to the focused cell's
// box (there is no cursor position on focus) so Tab-navigation surfaces the same
// popover as hovering.
function showTipAtEl(cell, ev) {
  tip.value = {
    pos: cell.pos,
    ch: cell.ch,
    intensity: cell.intensity,
    depth: cell.depth,
    mods: cell.mods,
    x: 0,
    y: 0,
  }
  const rect = ev.target?.getBoundingClientRect?.()
  if (rect) {
    moveTip({ clientX: rect.left + rect.width / 2, clientY: rect.bottom })
  }
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
      // New protein: reset the window to the front and clear PTM/jump state.
      windowStart.value = 0
      windowEnd.value = Math.min(WINDOW, data.sequence.length)
      hiddenPtms.value = new Set()
      jumpFrom.value = ''
      jumpTo.value = ''
      jumpCapped.value = false
      // The scroll container mounts with the map (v-if); measure it now.
      nextTick(() => {
        computeCols()
        if (ro && scrollEl.value) ro.observe(scrollEl.value)
      })
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
  margin-bottom: 24px;
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
.sm-summary {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-secondary);
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
.sm-cell:focus-visible {
  outline: 2px solid var(--indigo);
  outline-offset: 1px;
  z-index: 4;
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
/* Terminal (N-/C-term) mods keep their residue mark but gain a distinct accent
   underline + a tiny corner badge so they don't read as ordinary side-chain marks. */
.sm-cell.sm-has-term {
  box-shadow: inset 0 -2px 0 0 var(--indigo);
}
.sm-term-badge {
  position: absolute;
  top: -4px;
  left: -3px;
  z-index: 3;
  padding: 0 2px;
  font-size: 7px;
  line-height: 1.4;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
  border-radius: 3px;
  pointer-events: none;
}
.sm-term-n {
  background: var(--indigo);
}
.sm-term-c {
  background: var(--violet);
}
.sm-note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

/* --- Shared control button ------------------------------------------------ */
.sm-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
}
.sm-btn:hover:not(:disabled) {
  border-color: var(--indigo);
  color: var(--indigo);
}
.sm-btn:focus-visible {
  outline: 2px solid var(--indigo);
  outline-offset: 1px;
}
.sm-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.sm-btn-sm {
  padding: 3px 9px;
  font-size: 11px;
}

/* --- Region navigation ---------------------------------------------------- */
.sm-nav {
  margin-bottom: 12px;
}
.sm-nav-main {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.sm-nav-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.sm-nav-btns {
  display: inline-flex;
  gap: 6px;
}
.sm-nav-jump {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.sm-nav-jump-lbl {
  font-size: 11px;
  color: var(--text-muted);
}
.sm-nav-input {
  width: 74px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px 8px;
}
.sm-nav-input:focus-visible {
  outline: 2px solid var(--indigo);
  outline-offset: 1px;
  border-color: var(--indigo);
}
.sm-nav-dash {
  color: var(--text-muted);
}
.sm-nav-note {
  margin-top: 6px;
}
.sm-minimap {
  position: relative;
  height: 6px;
  margin-top: 10px;
  border-radius: 3px;
  background: var(--bg-alt);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}
.sm-minimap-seg {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 2px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--indigo), var(--violet));
}

/* --- PTM visibility filter ------------------------------------------------ */
.sm-ptm-filter {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sm-ptm-filter-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding-top: 5px;
}
.sm-ptm-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.sm-ptm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 3px 10px;
  cursor: pointer;
  transition: border-color 0.12s ease, opacity 0.12s ease;
}
.sm-ptm-chip:hover {
  border-color: var(--indigo);
}
.sm-ptm-chip:focus-visible {
  outline: 2px solid var(--indigo);
  outline-offset: 1px;
}
.sm-ptm-name {
  font-weight: 600;
  color: var(--text-primary);
}
.sm-ptm-count {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}
.sm-ptm-chip.sm-ptm-off {
  opacity: 0.5;
}
.sm-ptm-chip.sm-ptm-off .sm-ptm-name {
  color: var(--text-secondary);
  text-decoration: line-through;
}
.sm-ptm-actions {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
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
.sm-tip-term {
  font-weight: 700;
  color: var(--indigo-light);
}
</style>
