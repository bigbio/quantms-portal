// Two-axis dataset classification for differential expression.
//
// A dataset is described by TWO INDEPENDENT badges, never one combined grade:
//
//   DATA QUALITY     — is the measurement trustworthy?  high | medium | low
//   STATISTICAL POWER — how much can this design detect? strong | moderate | limited
//
// The axes are deliberately separate because a dataset can be pristine and
// still underpowered. PXD041047 is exactly that: replicate r = 0.976, 7.9%
// missingness and a clean p-value distribution (quality: high) but only n = 3
// per group (power: moderate), which is why only 23 proteins reach
// significance. A single grade would either overstate what the design can
// detect or unfairly disparage clean data.
//
// The badge is a summary, never a replacement for the numbers: every place
// that renders these levels also renders the underlying metrics next to them.
//
// Levels and thresholds are produced by the backend
// (apps/differential_expression/qc.py); this module only maps a level to how
// it is displayed. Datasets built before the classification was added carry no
// level at all, so every lookup falls back to a neutral 'unknown' entry rather
// than throwing or rendering a broken badge.
//
// Colors follow the conventions of ./regulation.js: one literal hex per level,
// mirrored into the --qual-* / --power-* variables in src/style.css so CSS and
// JS can never drift. They are chosen to stay legible on the portal's light
// surface (contrast >= ~4.5:1 against #fff) and reuse the palette already used
// by the QC gate badge (pass green / warn amber / fail red). Green-amber-red is
// not distinguishable for the common color vision deficiencies, so each badge
// also carries its own text label and a title/aria-label description — the
// level is never conveyed by color alone.

const UNKNOWN_COLOR = '#64748b'

export const QUALITY_META = {
  high: {
    key: 'high',
    label: 'High data quality',
    short: 'High',
    color: '#047857',
    description:
      'Replicates agree closely, few values are missing, the conditions separate and the p-values are well calibrated — the measurements can be trusted.',
  },
  medium: {
    key: 'medium',
    label: 'Medium data quality',
    short: 'Medium',
    color: '#b45309',
    description:
      'One or more QC signals (replicate agreement, missingness, condition separation, p-value calibration) fall short of the high bar — interpret the results with care.',
  },
  low: {
    key: 'low',
    label: 'Low data quality',
    short: 'Low',
    color: '#dc2626',
    description:
      'QC signals indicate the measurements are not reliable enough for differential testing.',
  },
  unknown: {
    key: 'unknown',
    label: 'Data quality unknown',
    short: 'Unknown',
    color: UNKNOWN_COLOR,
    description: 'This dataset was processed before quality classification was available.',
  },
}

export const POWER_META = {
  strong: {
    key: 'strong',
    label: 'Strong statistical power',
    short: 'Strong',
    color: '#047857',
    description:
      'At least 5 replicates in the smallest group — the design can detect moderate changes.',
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate statistical power',
    short: 'Moderate',
    color: '#b45309',
    description:
      'Only 3 to 4 replicates in the smallest group. FDR correction limits how many changes can reach significance, so expect a short list of significant proteins even when the data are clean.',
  },
  limited: {
    key: 'limited',
    label: 'Limited statistical power',
    short: 'Limited',
    color: '#dc2626',
    description:
      'Fewer than 3 replicates in the smallest group — differential testing is unreliable regardless of data quality.',
  },
  unknown: {
    key: 'unknown',
    label: 'Statistical power unknown',
    short: 'Unknown',
    color: UNKNOWN_COLOR,
    description: 'This dataset was processed before power classification was available.',
  },
}

// Display / sort order: best first, with 'unknown' last so unclassified
// datasets sink to the bottom of a sorted picker column.
export const QUALITY_ORDER = ['high', 'medium', 'low', 'unknown']
export const POWER_ORDER = ['strong', 'moderate', 'limited', 'unknown']

// Accepts either a bare level string ('high') or the backend classification
// object ({ level: 'high', reasons: [...] }), and normalizes case/whitespace.
// Anything unrecognized — null, undefined, '', a typo, a number — becomes
// 'unknown'.
function normalizeLevel(value, meta) {
  const raw = value && typeof value === 'object' ? value.level : value
  if (typeof raw !== 'string') return 'unknown'
  const key = raw.trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(meta, key) && key !== 'unknown' ? key : 'unknown'
}

// Level key for a data-quality value, always one of QUALITY_ORDER.
export function qualityLevel(value) {
  return normalizeLevel(value, QUALITY_META)
}

// Level key for a statistical-power value, always one of POWER_ORDER.
export function powerLevel(value) {
  return normalizeLevel(value, POWER_META)
}

// Display metadata for a data-quality level; never returns undefined.
export function qualityMeta(value) {
  return QUALITY_META[qualityLevel(value)]
}

// Display metadata for a statistical-power level; never returns undefined.
export function powerMeta(value) {
  return POWER_META[powerLevel(value)]
}

// Sortable rank (0 = best) following QUALITY_ORDER / POWER_ORDER.
export function qualityRank(value) {
  return QUALITY_ORDER.indexOf(qualityLevel(value))
}

export function powerRank(value) {
  return POWER_ORDER.indexOf(powerLevel(value))
}

// The `reasons` the backend attached to a classification, as a clean string
// array. Returns [] for a bare level string or a malformed/absent block, so
// callers can render it unconditionally.
export function classificationReasons(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.reasons)) return []
  return value.reasons.filter((r) => typeof r === 'string' && r.trim()).map((r) => r.trim())
}

// Full human-readable explanation for a badge: the level description followed
// by any backend reasons. Used as the title/aria-label so the badge is
// understandable without relying on its color.
export function badgeTitle(meta, value) {
  const reasons = classificationReasons(value)
  return reasons.length ? `${meta.label} — ${meta.description} (${reasons.join('; ')})` : `${meta.label} — ${meta.description}`
}
