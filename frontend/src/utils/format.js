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
