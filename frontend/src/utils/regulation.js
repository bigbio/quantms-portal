// Regulation direction for a differential-expression result row.
//
// The conventional volcano/table reading is directional, not a single
// significant-vs-not split: a significant protein that goes UP in group B is
// red, one that goes DOWN is blue, and everything non-significant is neutral
// grey. This module is the single source of truth for that classification and
// its colors so VolcanoPlot (canvas, needs literal colors) and DeResultsTable
// (CSS, uses the mirrored --reg-* variables in style.css) can never drift.
//
// Colors are picked to stay legible on both a light and a dark surface
// (contrast >= ~3.7:1 against #fff and >= ~4.5:1 against #0f172a) and form a
// red/blue divergent pair, which stays distinguishable for the common
// red-green color vision deficiencies. The dot/label in the table means the
// class is never conveyed by color alone.

export const REGULATION_META = {
  up: { key: 'up', label: 'Up-regulated', short: 'Up', color: '#e5484d' },
  down: { key: 'down', label: 'Down-regulated', short: 'Down', color: '#3b82f6' },
  ns: { key: 'ns', label: 'Unchanged', short: 'Not significant', color: '#94a3b8' },
}

// Display / sort order: the interesting classes first, unchanged last.
export const REGULATION_ORDER = ['up', 'down', 'ns']

// Classify a contract row: 'up' (significant & log2fc > 0), 'down'
// (significant & log2fc < 0), else 'ns'. Null/undefined/NaN/non-numeric
// log2fc, a missing `significant` flag, and a null row all fall back to 'ns' —
// a direction is only ever asserted when both pieces of evidence are present.
export function regulationClass(row) {
  if (!row || !row.significant) return 'ns'
  const fc = Number(row.log2fc)
  if (row.log2fc === null || row.log2fc === undefined || !Number.isFinite(fc)) return 'ns'
  if (fc > 0) return 'up'
  if (fc < 0) return 'down'
  return 'ns' // exactly zero fold change is no change
}

// Display metadata (key/label/short/color) for a row's class.
export function regulationMeta(row) {
  return REGULATION_META[regulationClass(row)]
}

// Sortable rank of a row's class, following REGULATION_ORDER.
export function regulationRank(row) {
  return REGULATION_ORDER.indexOf(regulationClass(row))
}
