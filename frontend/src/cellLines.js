// Cancer Cell Line Proteome API wrappers and pure display helpers.
import { apiGet, buildQuery, encodePath } from './api.js'
import { CELL_LINES_BASE } from './config.js'

export const MAX_COMPARE_LINES = 5
export const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'protein', label: 'Protein' },
  { id: 'line', label: 'Cell line' },
  { id: 'compare', label: 'Compare' },
  { id: 'coexpression', label: 'Co-expression' },
  { id: 'datasets', label: 'Datasets' },
]
export const GROUP_KINDS = [
  { id: 'lineage', label: 'Lineage' },
  { id: 'primary_disease', label: 'Primary disease' },
]

const get = (path, params) => apiGet(CELL_LINES_BASE, path, params)

export const getManifest = () => get('/manifest')
export const getOverview = () => get('/overview')
// One fetch per page load: the cell-line list backs both the Cell line browser and the Compare picker.
let allLinesPromise = null
export const getAllLines = () => {
  allLinesPromise ||= get('/lines/all').then((r) => r.lines || []).catch((e) => { allLinesPromise = null; throw e })
  return allLinesPromise
}
/** Query params of GET /table from the table's filter state. */
export const tableParams = (f = {}) => ({
  q: f.q, lineage: f.lineage, cats: (f.cats || []).join(','), rels: (f.rels || []).join(','),
  hide_flagged: f.hide ? 'true' : '', sort: f.sort, descending: f.descending === undefined ? '' : String(f.descending),
  offset: f.offset, limit: f.limit,
})
export const getTable = (f) => get('/table', tableParams(f))
export const tableCsvUrl = (f) => `${CELL_LINES_BASE}/table${buildQuery({ ...tableParams({ ...f, offset: undefined, limit: undefined }), format: 'csv' })}`
export const searchGenes = (q, limit = 12) => get('/genes', { q, limit }).then((r) => r.genes || [])
export const getGene = (gene) => get(`/genes/${encodePath(gene)}`)
export const getGeneRna = (gene) => get(`/genes/${encodePath(gene)}/rna`)
export const getGeneCoexpression = (gene) => get(`/genes/${encodePath(gene)}/coexpression`)
export const searchLines = (q, limit = 12) => get('/lines', { q, limit }).then((r) => r.lines || [])
export const getLine = (line) => get(`/lines/${encodePath(line)}`)
export const getGroups = () => get('/groups').then((r) => r.groups || [])
export const getDatasets = () => get('/datasets').then((r) => r.studies || [])

/** Query params for GET /compare, or null when the selection is incomplete. */
export function compareParams({ mode, lines, group, a, b, reproducibleOnly } = {}) {
  if (mode === 'groups') {
    if (!GROUP_KINDS.some((g) => g.id === group) || !a || !b || a === b) return null
    return { group, a, b, background: true }
  }
  const picked = [...new Set((lines || []).filter(Boolean))]
  if (picked.length < 2 || picked.length > MAX_COMPARE_LINES) return null
  return reproducibleOnly ? { lines: picked.join(','), reproducible_only: true } : { lines: picked.join(',') }
}

/** Diverging fill for a log2 amount vs the study average: blue below, orange above; clamped at ±4. */
export function amountColor(v) {
  if (!Number.isFinite(v)) return 'transparent'
  const t = Math.min(1, Math.abs(v) / 4)
  return v >= 0 ? mixHex('#ffffff', '#c2410c', t) : mixHex('#ffffff', '#1d4ed8', t)
}

export function compare(selection) {
  const params = compareParams(selection)
  if (!params) return Promise.resolve(null)
  return get('/compare', params)
}

/** Tab id from the URL query, defaulting to the protein tab. */
export function tabFromQuery(query) {
  const t = String(query?.tab || '')
  if (TABS.some((x) => x.id === t)) return t
  return query?.gene ? 'protein' : query?.line ? 'line' : 'overview'
}

/** Split a comma list from the URL query ("a,b" or ["a","b"]). */
export function listFromQuery(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '')
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))]
}

export function errorMessage(err, what = 'This item') {
  const status = err?.status
  if (status === 503) return 'The atlas is loading, try again shortly.'
  if (status === 404) return `${what} is not in the atlas.`
  return 'The cell-line atlas is temporarily unavailable.'
}

// Presence ------------------------------------------------------------------

/** Presence state of one line × gene row from GET /genes/{gene}. */
export function presenceState(row) {
  if (!row || !(row.n_studies_measured > 0)) return 'unmeasured'
  if (row.n_studies_present_high > 0) return 'high'
  if (row.n_studies_present > 0) return 'detected'
  if (row.n_studies_plex_identified > 0) return 'nocall'
  return 'absent'
}

// Groups smaller than this are hidden by default (same minimum as specificity and compare).
export const MIN_GROUP_LINES = 3
// Quartiles need at least this many lines.
export const BOX_MIN_LINES = 5

/** Group kind from the `by` URL param (lineage | disease). */
export const kindFromQuery = (by) => (by === 'disease' ? 'primary_disease' : 'lineage')
export const byParam = (kind) => (kind === 'primary_disease' ? 'disease' : 'lineage')

function quantile(sorted, p) {
  if (!sorted.length) return null
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** Five-number summary of the finite values. */
export function boxStats(values) {
  const v = (values || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  return { min: v[0], q1: quantile(v, 0.25), median: quantile(v, 0.5), q3: quantile(v, 0.75), max: v[v.length - 1], n: v.length }
}

/**
 * Dot-plot rows from the API group summary (A49): within-study enrichment vs the other lines of the
 * same studies, detection among lines with a presence call; per-line rows feed the expanded strip.
 */
export function groupDots(lines, groups, kind = 'lineage') {
  const byValue = new Map()
  for (const row of lines || []) {
    const state = presenceState(row)
    if (state === 'unmeasured') continue
    const key = row[kind] ?? 'unmapped'
    if (!byValue.has(key)) byValue.set(key, [])
    byValue.get(key).push({ ...row, state })
  }
  const out = (groups || []).filter((g) => g.kind === kind).map((g) => {
    const rows = byValue.get(g.value) || []
    const l4 = rows.map((r) => r.l4_mean).filter((v) => Number.isFinite(v))
    const enrichment = Number.isFinite(g.enrichment) ? g.enrichment : null
    return {
      value: g.value, rows, enrichment, n_called: g.n_called || 0, n_detected: g.n_detected || 0,
      n_lines: g.n_lines ?? rows.length, n_studies: g.n_studies ?? null,
      frac: g.n_called > 0 ? (g.n_detected || 0) / g.n_called : null,
      box: l4.length >= BOX_MIN_LINES ? boxStats(l4) : null,
      small: enrichment === null || (g.n_lines ?? rows.length) < MIN_GROUP_LINES,
    }
  })
  return out.sort((a, b) => a.small - b.small || (a.enrichment === null) - (b.enrichment === null) ||
    (b.enrichment ?? 0) - (a.enrichment ?? 0) || b.n_lines - a.n_lines)
}

/** Five-number box with Tukey whiskers (most extreme values within 1.5×IQR of the box). */
export function tukeyBox(values) {
  const box = boxStats(values)
  if (!box) return null
  const v = values.filter((x) => Number.isFinite(x))
  const iqr = box.q3 - box.q1
  const inLo = v.filter((x) => x >= box.q1 - 1.5 * iqr)
  const inHi = v.filter((x) => x <= box.q3 + 1.5 * iqr)
  return { ...box, iqr, lo: Math.min(...inLo), hi: Math.max(...inHi) }
}

/**
 * One summary row per group, in dot-plot order: detection rate and within-study enrichment (A49) from the API
 * group summary, plus each line's amount (l3_mean) as points and measured-not-detected lines apart. Lines
 * without a presence call are counted, not plotted.
 */
export function groupSummary(lines, groups, kind = 'lineage') {
  return groupDots(lines, groups, kind).map((g) => {
    const rows = g.rows.filter((r) => r.state !== 'nocall')
    const row = (r) => ({ line: r.line, name: r.name || r.line, lineage: r.lineage, primary_disease: r.primary_disease })
    const points = rows.filter((r) => Number.isFinite(r.l3_mean))
      .map((r) => ({ ...row(r), value: r.l3_mean, detected: r.state === 'high' || r.state === 'detected' }))
    const absent = rows.filter((r) => !Number.isFinite(r.l3_mean) && r.state === 'absent').map(row)
    const vals = points.map((p) => p.value)
    return {
      ...g, points, absent, nocall: g.rows.filter((r) => r.state === 'nocall').length,
      median: boxStats(vals)?.median ?? null,
      box: vals.length >= BOX_MIN_LINES ? tukeyBox(vals) : null,
    }
  })
}

/** A log2 difference in words: "2.0× the average" / "2.0× below the average". */
export const foldText = (v, what = 'the average') =>
  (v >= 0 ? `${fmt(2 ** v, 1)}× ${what}` : `${fmt(2 ** -v, 1)}× below ${what}`)

// Profile within one study ------------------------------------------------------

/** Label of the profile estimator(s) a study's values come from. */
export const methodLabel = (study) => (study?.methods || []).join(' / ') || 'unknown method'

/**
 * One study's lines grouped by lineage or disease. Points carry the line's log2 difference from the
 * study average (l3); measured lines without a value are listed as not detected, never plotted as values.
 */
export function studyProfile(values, lines, study, kind = 'lineage') {
  const meta = new Map((lines || []).map((l) => [l.line, l]))
  const groups = new Map()
  for (const v of values || []) {
    if (v.study !== study) continue
    const line = meta.get(v.line) || { line: v.line }
    const key = line[kind] ?? 'unmapped'
    if (!groups.has(key)) groups.set(key, { value: key, points: [], absent: [] })
    const row = { line: v.line, name: line.name || v.line, lineage: line.lineage }
    if (Number.isFinite(v.l3)) groups.get(key).points.push({ ...row, value: v.l3, detected: !!v.present, scope: v.presence_scope })
    else groups.get(key).absent.push(row)
  }
  return [...groups.values()].map((g) => {
    const vals = g.points.map((p) => p.value)
    return { ...g, median: boxStats(vals)?.median ?? null, box: vals.length >= BOX_MIN_LINES ? tukeyBox(vals) : null }
  }).sort((a, b) => (b.median ?? -Infinity) - (a.median ?? -Infinity) || b.points.length - a.points.length)
}

/** Symmetric log2 axis around the study average, in whole units. */
export function profileAxis(groups) {
  const vals = (groups || []).flatMap((g) => g.points.map((p) => p.value))
  const m = Math.max(1, Math.ceil(Math.max(0, ...vals.map((v) => Math.abs(v)))))
  const step = m > 6 ? 2 : 1
  const ticks = []
  for (let t = -m; t <= m; t += step) ticks.push(t)
  return { min: -m, max: m, ticks }
}

// Overview ------------------------------------------------------------------------

export const SPEC_STYLES = {
  'lineage enriched': { fg: '#5b21b6', bg: '#ede9fe', dot: '#7c3aed' },
  'group enriched': { fg: '#1e40af', bg: '#dbeafe', dot: '#2563eb' },
  enhanced: { fg: '#115e59', bg: '#ccfbf1', dot: '#0d9488' },
  'low specificity': { fg: '#475569', bg: '#f1f5f9', dot: '#94a3b8' },
  insufficient: { fg: '#64748b', bg: '#ffffff', dot: '#cbd5e1' },
  'not detected': { fg: '#64748b', bg: '#ffffff', dot: '#cbd5e1' },
  'not scored': { fg: '#64748b', bg: '#ffffff', dot: '#e2e8f0' },
}
export const SPEC_KEYS = ['lineage enriched', 'group enriched', 'enhanced', 'low specificity', 'insufficient', 'not scored']
export const RELIABILITY_STYLES = {
  reproducible: { fg: '#14532d', bg: '#dcfce7', bar: '#16a34a' },
  partial: { fg: '#78350f', bg: '#fef3c7', bar: '#d97706' },
  uncertain: { fg: '#881337', bg: '#ffe4e6', bar: '#e11d48' },
  'not scored': { fg: '#64748b', bg: '#f8fafc', bar: '#cbd5e1' },
}
export const RELIABILITY_KEYS = ['reproducible', 'partial', 'uncertain', 'not scored']
export const specStyle = (c) => SPEC_STYLES[c] || SPEC_STYLES['not scored']
export const reliabilityStyle = (c) => RELIABILITY_STYLES[c] || RELIABILITY_STYLES['not scored']

/** A stable colour per lineage name, the same on every tab. */
export function lineageColor(name) {
  let x = 0
  for (const ch of String(name)) x = (x * 31 + ch.charCodeAt(0)) >>> 0
  const h = Math.round(((x * 0.618033988749895) % 1) * 360)
  return { fg: `hsl(${h} 62% 28%)`, bg: `hsl(${h} 75% 93%)`, dot: `hsl(${h} 60% 45%)` }
}
export const lineageColors = (lineages) => Object.fromEntries(lineages.map((l) => [l, lineageColor(l)]))

export const ACQ_STYLES = {
  DIA: { fg: '#1e3a8a', bg: '#dbeafe' },
  DDA: { fg: '#115e59', bg: '#ccfbf1' },
  TMT: { fg: '#7c2d12', bg: '#ffedd5' },
}

/** Linear mix of two #rrggbb colours (t = 0..1). */
export function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const k = Math.min(1, Math.max(0, t))
  return `rgb(${pa.map((x, i) => Math.round(x + (pb[i] - x) * k)).join(', ')})`
}

/** Heatmap rows grouped by their top lineage, with a flag on the first row of each group. */
export function heatmapRows(heatmap) {
  let prev = null
  return (heatmap || []).map((r) => {
    const first = r.lineage !== prev
    prev = r.lineage
    return { ...r, first }
  })
}

// Proteins without a reproducibility score are drawn in a band below the axis.
export const LANDSCAPE_NOSCORE_Y = -0.35

/** Landscape scatter: one dataset per specificity group; dot size grows with co-expression partners. */
export function landscapeDatasets(landscape) {
  const cols = landscape?.columns || []
  const at = Object.fromEntries(cols.map((c, i) => [c, i]))
  const groups = ['lineage enriched', 'group enriched', 'enhanced', 'low specificity', 'other']
  const by = Object.fromEntries(groups.map((g) => [g, []]))
  ;(landscape?.rows || []).forEach((r, i) => {
    const cat = r[at.spec_cat3]
    const key = by[cat] ? cat : 'other'
    const icc = r[at.icc]
    by[key].push({
      x: r[at.detected_fraction] ?? 0,
      y: Number.isFinite(icc) ? Math.max(-0.2, icc) : LANDSCAPE_NOSCORE_Y + (((i * 37) % 17) - 8) * 0.008,
      gene: r[at.gene], cat, icc, cx: r[at.coexpression_partners] || 0,
    })
  })
  const rgba = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')}, ${a})`
  return groups.map((g) => {
    const style = g === 'other' ? SPEC_STYLES.insufficient : SPEC_STYLES[g]
    const strong = g !== 'low specificity' && g !== 'other'
    return {
      label: g === 'other' ? 'insufficient / not scored' : g,
      data: by[g],
      backgroundColor: rgba(style.dot, strong ? 0.85 : 0.3),
      pointRadius: by[g].map((p) => 1.6 + Math.min(5, p.cx / 4)),
      pointHoverRadius: 6,
      order: strong ? 0 : 1,
    }
  })
}

// RNA reference ------------------------------------------------------------------

export const RNA_STATES = [
  { id: 'detected', label: 'Detected' },
  { id: 'absent', label: 'Not detected' },
]

/** DepMap log2(TPM+1) per protein state; lines without a presence call or not measured are counted apart. */
export function rnaByDetection(rows) {
  const values = Object.fromEntries(RNA_STATES.map((s) => [s.id, []]))
  let unmeasured = 0
  let nocall = 0
  for (const r of rows || []) {
    if (!Number.isFinite(r.log2_tpm)) continue
    if (values[r.protein_state]) values[r.protein_state].push(r.log2_tpm)
    else if (r.protein_state === 'plex') nocall++
    else unmeasured++
  }
  const all = Object.values(values).flat()
  return {
    groups: RNA_STATES.map((s) => ({ ...s, values: values[s.id], n: values[s.id].length, box: boxStats(values[s.id]) })),
    min: all.length ? Math.min(...all) : 0,
    max: all.length ? Math.max(...all) : 0,
    unmeasured,
    nocall,
  }
}

// RNA agreement strength cut-offs (display choices): detection AUC and amount Spearman.
export const RNA_AUC_CUTS = [0.85, 0.7]
export const RNA_RHO_CUTS = [0.6, 0.35]
export const rnaStrength = (v, [strong, moderate]) =>
  (!Number.isFinite(v) ? 'none' : v >= strong ? 'strong' : v >= moderate ? 'moderate' : 'weak')

/** Plain reading of RNA vs protein: whether RNA predicts detection, then whether amount follows RNA. */
export function rnaVerdict(agreement, flatSd = 0.5) {
  if (!agreement) return null
  const auc = agreement.rna_detect_auc
  const rho = agreement.rna_amount_rho
  const icc = agreement.icc
  if (!Number.isFinite(auc) && !Number.isFinite(rho)) {
    if (agreement.flat_rna) return { key: 'flat', text: `RNA barely varies across lines (SD < ${flatSd}); a comparison is not informative.` }
    return { key: 'none', text: `Detected in ${agreement.rna_detect_lines ?? 0} lines with RNA: too few to compare with RNA.` }
  }
  const parts = []
  const a = rnaStrength(auc, RNA_AUC_CUTS)
  if (a === 'strong') parts.push(`RNA predicts where the protein is detected (AUC ${fmt(auc)}).`)
  else if (a === 'moderate') parts.push(`RNA partly predicts where the protein is detected (AUC ${fmt(auc)}).`)
  else if (a === 'weak') parts.push(`RNA does not predict where the protein is detected (AUC ${fmt(auc)}).`)
  const r = rnaStrength(rho, RNA_RHO_CUTS)
  if (r === 'strong') parts.push(`Where detected, the amount follows RNA (ρ ${fmt(rho)}).`)
  else if (r === 'moderate') parts.push(`Where detected, the amount follows RNA moderately (ρ ${fmt(rho)}).`)
  else if (r === 'weak') {
    parts.push(`Where detected, the amount barely follows RNA (ρ ${fmt(rho)})` +
      (Number.isFinite(icc) && icc < 0.5 ? `, but protein reliability is limited (ICC ${fmt(icc)}).` : '.'))
  }
  const best = [a, r].includes('strong') ? 'tracks' : [a, r].includes('moderate') ? 'moderate' : 'limited'
  return { key: best, text: parts.join(' ') }
}

const GREY = 'rgba(100, 116, 139, 0.45)'
const INDIGO = 'rgba(79, 70, 229, 0.9)'

/** RNA (x) vs amount (y, log2 difference from the study average) for detected lines; one lineage may be highlighted. */
export function detectedScatter(rows, xKey, { transform = (x) => x, isDetected = (r) => r.protein_state === 'detected', highlight = '' } = {}) {
  const base = []
  const hi = []
  let excluded = 0
  for (const r of rows || []) {
    const x = r[xKey]
    if (!Number.isFinite(x)) continue
    if (!isDetected(r)) { if (!['unmeasured', 'plex'].includes(r.protein_state)) excluded++; continue }
    if (!Number.isFinite(r.amount)) continue
    const p = { x: transform(x), y: r.amount, label: r.name || r.line, lineage: r.lineage || 'unmapped' }
    ;(highlight && p.lineage === highlight ? hi : base).push(p)
  }
  const xs = [...base, ...hi].map((p) => p.x)
  const lo = xs.length ? Math.min(...xs) : 0
  const top = xs.length ? Math.max(...xs) : 1
  const pad = Math.max(0.25, (top - lo) * 0.05)
  const datasets = [{ label: 'detected lines', data: base, backgroundColor: GREY, pointRadius: 3, pointHoverRadius: 5, order: 1 }]
  if (highlight) datasets.unshift({ label: highlight, data: hi, backgroundColor: INDIGO, pointRadius: 4, pointHoverRadius: 6, order: 0 })
  return { n: xs.length, highlighted: hi.length, excluded, xMin: Math.max(0, lo - pad), xMax: top + pad, data: { datasets } }
}

// Co-expression -----------------------------------------------------------------

export const COEXP_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'beyond', label: 'Beyond shared complexes' },
  { id: 'validated', label: 'Validated only' },
]

export const noPartnersText = (gene, minZ = 4) =>
  `No partners at |Z| ≥ ${minZ} for ${gene}: its co-variation across lines is not distinguishable from chance.`

export function filterPartners(partners, mode = 'all') {
  const rows = partners || []
  if (mode === 'validated') return rows.filter((p) => p.validated)
  if (mode === 'beyond') return rows.filter((p) => !(p.shared_complexes || []).length)
  return rows
}

// Formatting --------------------------------------------------------------------

export function fmt(v, digits = 2) {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—'
  return Number(v).toFixed(digits)
}

export function pct(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—'
  return `${Math.round(Number(v) * 100)}%`
}


/** Diverging fill for a within-study enrichment: blue below 0, grey at 0, red above; clamped at ±0.5. */
export function enrichmentColor(v) {
  if (!Number.isFinite(v)) return 'transparent'
  const t = Math.min(1, Math.max(-1, v / 0.5))
  const [from, to] = t < 0 ? [[203, 213, 225], [37, 99, 235]] : [[203, 213, 225], [220, 38, 38]]
  const k = Math.abs(t)
  const mix = (i) => Math.round(from[i] + (to[i] - from[i]) * k)
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`
}

/** Signed two-decimal number, e.g. +0.35. */
export function signed(v, digits = 2) {
  if (!Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(digits)}`
}

/** Sort a copy of rows by key; nulls last. */
export function sortRows(rows, key, dir = 'desc') {
  const s = dir === 'asc' ? 1 : -1
  return [...(rows || [])].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    if (x === y) return 0
    if (x === null || x === undefined || x === '') return 1
    if (y === null || y === undefined || y === '') return -1
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * s
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * s
  })
}

/** External page for a study accession (PRIDE, MassIVE or PubMed), or '' when unknown. */
export function accessionUrl(acc) {
  const a = String(acc || '').trim()
  if (/^PXD\d+$/i.test(a)) return `https://www.ebi.ac.uk/pride/archive/projects/${a.toUpperCase()}`
  if (/^MSV\d+$/i.test(a)) return `https://massive.ucsd.edu/ProteoSAFe/dataset.jsp?accession=${a.toUpperCase()}`
  const pmid = /^PMID:?\s*(\d+)$/i.exec(a)
  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}`
  return ''
}

/** Co-expression partners on one circle, ordered by Z from 12 o'clock; strength is for edge width and opacity. */
export function radialLayout(edges, { cx = 300, cy = 300, radius = 230 } = {}) {
  const n = edges.length
  const maxZ = Math.max(...edges.map((e) => Math.abs(e.z) || 0), 1)
  return [...edges].sort((a, b) => b.z - a.z).map((e, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1)
    const strength = Math.abs(e.z) / maxZ
    return {
      ...e, strength, angle,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      anchor: Math.cos(angle) >= 0 ? 'start' : 'end',
    }
  })
}
