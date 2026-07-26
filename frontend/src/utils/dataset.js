// Display helpers for the differential-expression dataset catalogue.
//
// The `/de/datasets` entries are progressively enriched by the backend: a
// dataset rebuilt today carries a title, summary, contrasts, a results roll-up
// and a free-form `context` map, while one built before those existed carries
// little more than `ref` + `accession`. Every helper here therefore treats each
// field as optional and returns an EMPTY list (never a placeholder, never
// "undefined"/"null") when the information is simply not known — the caller
// omits the whole block instead of rendering a hole.
import { formatNum, cleanInstrument } from './format.js'

// Full localized count. Unlike formatNum() a real zero stays "0": in a results
// roll-up "0 significant" is a measured outcome, not missing information.
function count(v) {
  return Number(v) === 0 ? '0' : formatNum(v)
}

function isPresent(v) {
  return v != null && v !== '' && !Number.isNaN(Number(v))
}

// Primary display line for a dataset: its title, falling back to the accession
// so a row is never nameless.
export function datasetTitle(d) {
  const t = d && typeof d.title === 'string' ? d.title.trim() : ''
  return t || (d && d.accession) || (d && d.ref) || 'Unknown dataset'
}

// Compact results roll-up: [{ key, value, label, title }] rendered as
// "4,094 quantified · 20 significant · 66 on/off". Absent counters are dropped
// rather than shown as an em-dash, so a partially built dataset degrades to a
// shorter line (or to nothing at all).
const RESULT_PARTS = [
  {
    key: 'quantified',
    field: 'n_quantified',
    label: 'quantified',
    title: 'Proteins quantified across the compared conditions',
  },
  {
    key: 'significant',
    field: 'n_significant',
    label: 'significant',
    title: 'Proteins passing the adjusted p-value / fold-change thresholds',
  },
  {
    key: 'on_off',
    field: 'n_on_off',
    label: 'on/off',
    title: 'On/off proteins: quantified in one condition and absent in the other',
  },
]

export function resultsSummary(results) {
  if (!results || typeof results !== 'object') return []
  return RESULT_PARTS.filter((p) => isPresent(results[p.field])).map((p) => ({
    key: p.key,
    value: count(results[p.field]),
    label: p.label,
    title: p.title,
  }))
}

// Context chips: cell line / tissue / disease / instrument / acquisition …
// Known keys come first in a fixed, human-meaningful order; any further key the
// backend starts sending is still shown (humanized) rather than silently lost.
const CONTEXT_META = [
  { key: 'cell_line', label: 'Cell line' },
  { key: 'organism_part', label: 'Organism part' },
  { key: 'tissue', label: 'Tissue' },
  { key: 'disease', label: 'Disease' },
  { key: 'instrument', label: 'Instrument', clean: cleanInstrument },
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'label', label: 'Labelling' },
]
const KNOWN_CONTEXT_KEYS = new Set(CONTEXT_META.map((m) => m.key))

function humanize(key) {
  const s = String(key).replace(/[_-]+/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : ''
}

function chip(key, label, raw, clean) {
  if (raw == null) return null
  const value = String(clean ? clean(raw) : raw).trim()
  if (!value) return null
  return { key, label, value, title: `${label}: ${value}` }
}

export function contextChips(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return []
  const chips = []
  for (const meta of CONTEXT_META) {
    const c = chip(meta.key, meta.label, context[meta.key], meta.clean)
    if (c) chips.push(c)
  }
  for (const key of Object.keys(context)) {
    if (KNOWN_CONTEXT_KEYS.has(key)) continue
    const raw = context[key]
    if (typeof raw !== 'string' && typeof raw !== 'number') continue
    const c = chip(key, humanize(key), raw)
    if (c) chips.push(c)
  }
  return chips
}

// A contrast's human label; ids like "DMSO__vs__Pomalidomide" are readable
// enough to use verbatim when no label was provided.
export function contrastLabel(c) {
  if (!c) return ''
  if (typeof c === 'string') return c.replace(/__vs__/g, ' vs ').trim()
  const label = typeof c.label === 'string' ? c.label.trim() : ''
  if (label) return label
  const id = typeof c.id === 'string' ? c.id.trim() : ''
  return id ? id.replace(/__vs__/g, ' vs ') : ''
}

// The comparisons a dataset offers, capped so a 40-contrast design cannot blow
// up the row: { shown: [{ id, label, factor }], extra: N }.
export function contrastChips(contrasts, max = 3) {
  const list = Array.isArray(contrasts) ? contrasts : []
  const named = list
    .map((c, i) => ({
      id: (c && c.id) || `contrast-${i}`,
      label: contrastLabel(c),
      factor: (c && c.factor) || '',
    }))
    .filter((c) => c.label)
  return { shown: named.slice(0, max), extra: Math.max(0, named.length - max) }
}

// Free-text match over the fields a user would actually type: title,
// accession, organism and the contrast labels. Empty query matches everything.
export function datasetMatches(d, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  if (!d) return false
  const hay = [
    d.title,
    d.accession,
    d.ref,
    d.organism,
    ...(Array.isArray(d.factors) ? d.factors : []),
    ...(Array.isArray(d.contrasts) ? d.contrasts.map(contrastLabel) : []),
  ]
    .filter((s) => typeof s === 'string' && s)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}
