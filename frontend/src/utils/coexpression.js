// Pure helpers for the Protein Co-expression view. The data is precomputed by the
// backend builder (quantms_portal_backend/apps/coexpression/builder.py) into
//   quantms/apps/coexpression/index.json
//   quantms/apps/coexpression/network/<shard>.json
// and read through browse.quantms.org. Keep shardOf() in sync with builder.shard_of().

export const PARTNER_COLUMNS = ['protein', 'gene', 'r', 'n_datasets', 'n_lines', 'sign_agree']

/** Shard key of a protein accession: first two characters, upper-cased. */
export function shardOf(accession) {
  return (String(accession || '').slice(0, 2) || '__').toUpperCase()
}

/** Turn a positional partner row into an object, honouring index.json's column order. */
export function partnerRow(row, columns = PARTNER_COLUMNS) {
  const o = {}
  columns.forEach((c, i) => { o[c] = row[i] })
  return o
}

/**
 * Search the index: exact gene or accession first, then gene prefix, then substring.
 * `proteins` rows are [accession, gene, n_datasets, n_lines].
 */
export function findProteins(proteins, query, limit = 12) {
  const q = String(query || '').trim().toUpperCase()
  if (!q) return []
  const exact = []
  const prefix = []
  const contains = []
  for (const p of proteins || []) {
    const acc = String(p[0]).toUpperCase()
    const gene = String(p[1] || '').toUpperCase()
    if (gene === q || acc === q) exact.push(p)
    else if (gene.startsWith(q) || acc.startsWith(q)) prefix.push(p)
    else if (gene.includes(q)) contains.push(p)
  }
  const byCoverage = (a, b) => (b[3] - a[3]) || String(a[1]).localeCompare(String(b[1]))
  return [...exact, ...prefix.sort(byCoverage), ...contains.sort(byCoverage)].slice(0, limit)
}

/**
 * Partners of `accession` in `scope`, filtered by |r|, sign, and capped at topN.
 * Rows arrive strongest-first from the builder; that order is preserved.
 */
export function partnersFor(shard, accession, scope, { minAbsR = 0, topN = 25, sign = 'both', columns } = {}) {
  const rows = shard?.[accession]?.[scope] || []
  return rows
    .map((r) => partnerRow(r, columns))
    .filter((p) => Math.abs(p.r) >= minAbsR)
    .filter((p) => sign === 'both' || (sign === 'positive' ? p.r > 0 : p.r < 0))
    .slice(0, topN)
}

/** Scopes this protein actually has partners in (so the picker never offers an empty one). */
export function scopesWithData(shard, accession, scopes) {
  const have = shard?.[accession] || {}
  return (scopes || []).filter((s) => (have[s.id] || []).length > 0)
}

/**
 * Radial layout: the query protein at the centre, partners on a circle, strongest
 * first starting at 12 o'clock. Stronger partners sit closer to the centre.
 */
export function radialLayout(partners, { cx = 300, cy = 300, radius = 230, inner = 0.55 } = {}) {
  const n = partners.length
  return partners.map((p, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1)
    const d = radius * (inner + (1 - inner) * (1 - Math.min(Math.abs(p.r), 1)))
    return {
      ...p,
      x: cx + d * Math.cos(angle),
      y: cy + d * Math.sin(angle),
      angle,
      anchor: Math.cos(angle) >= 0 ? 'start' : 'end',
    }
  })
}

/** Edge stroke width (px) from |r|. */
export function edgeWidth(r) {
  return 0.6 + 5 * Math.max(0, Math.abs(r) - 0.2) / 0.8
}
