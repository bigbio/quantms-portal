// Shared display formatters used across views.

// Compact big-number: 1_234_567 -> "1.2M".
export function formatBig(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(v)
}

// Full localized number, with an em-dash for empty/zero.
export function formatNum(n) {
  if (n == null || n === 0 || n === '') return '—'
  return Number(n).toLocaleString()
}

// Human-readable bytes.
export function formatBytes(b) {
  if (!b) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = Number(b)
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return v.toFixed(v >= 10 || i === 0 ? 0 : 1) + ' ' + u[i]
}

// Instrument strings sometimes arrive as "AC=MS:1002732;NT=Orbitrap Fusion Lumos".
// Show the human name (NT=) when present.
export function cleanInstrument(s) {
  if (!s) return ''
  const m = String(s).match(/NT=([^;]+)/)
  return (m ? m[1] : s).trim()
}

// --- PTM classification ------------------------------------------------------
// The backend annotates each modification / PTM site with a coarse biological
// relevance `class`:
//   biological          → real post-translational biology (Phospho, Acetyl@K, …)
//   fixed | label | artifact → chemistry / labelling / sample-prep, not biology
//   unknown             → unclassified
// It also sends a redundant boolean `is_biological` (== class === 'biological').
// Older payloads omit both — callers MUST degrade gracefully: ptmClassInfo()
// returns null so the UI falls back to its prior, unbadged rendering.
const PTM_CLASS_META = {
  biological: { key: 'biological', label: 'Biological', tagClass: 'ptm-bio', biological: true },
  artifact: { key: 'artifact', label: 'Artifact', tagClass: 'ptm-chem', biological: false },
  fixed: { key: 'fixed', label: 'Fixed', tagClass: 'ptm-chem', biological: false },
  label: { key: 'label', label: 'Label', tagClass: 'ptm-chem', biological: false },
  unknown: { key: 'unknown', label: 'Unknown', tagClass: 'ptm-unknown', biological: false },
}

// Resolve a raw class string to display metadata, or null when absent / empty /
// unrecognised (so the caller keeps its previous look).
export function ptmClassInfo(cls) {
  if (cls == null || cls === '') return null
  return PTM_CLASS_META[String(cls).toLowerCase()] || null
}

// True when a PTM record is biologically meaningful. Prefers the explicit
// `is_biological` boolean, falls back to the class string; false when neither
// is present (unknown → not asserted as biology).
export function isBiologicalPtm(rec) {
  if (rec && typeof rec.is_biological === 'boolean') return rec.is_biological
  const info = ptmClassInfo(rec && rec.class)
  return !!(info && info.biological)
}

// Stable tag color class per known collection.
export function collectionTag(name) {
  switch (name) {
    case 'absolute-expression':
      return 'tag-indigo'
    case 'differential-expression':
      return 'tag-violet'
    case 'msnet':
      return 'tag-blue'
    case 'single-cell-expression':
    case 'single-cell':
      return 'tag-green'
    default:
      return 'tag-blue'
  }
}
