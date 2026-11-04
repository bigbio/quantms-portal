// Sample-level protein abundance for the Explorer's analyses (sample map, group
// comparison, a protein across samples, heatmap, co-expression): the SQL the
// backend runs over one dataset, and the statistics computed here on its result.
//
// Every analysis reads the same values: log2 protein-group intensity per sample
// (decoys and contaminants removed), centred on the sample's median. Multiplexed
// data are also corrected for the plex: a ratio to the plex's pooled reference
// channel when the samples name one, otherwise centred on the protein's mean
// within the plex. Missing values are never imputed.

export const MIN_GROUP = 3 // observed values per group before a t-test is made
export const MIN_SHARED = 10 // shared samples before a correlation is reported
export const PCA_PROTEINS = 1000 // most variable proteins quantified in every sample

// --- design ------------------------------------------------------------------

const NOT_POOLED = /^(not pooled|not applicable|not available|none)$/i

// A pooled reference (bridge) channel: SDRF "pooled sample" says so ("pooled" or SN=...).
export function isReference(sample) {
  const v = sample && sample.pooled_sample
  return v != null && String(v).trim() !== '' && !NOT_POOLED.test(String(v).trim())
}

// How a dataset's values are corrected: 'none' (one sample per run), 'bridge'
// (ratio to the plex's pooled reference) or 'centre' (multiplexed, no reference).
export function analysisDesign(runs, samples) {
  const multiplexed = runs.some((r) => (r.samples || []).length > 1)
  const references = multiplexed ? samples.filter(isReference).map((s) => s.sample_accession) : []
  return { mode: multiplexed ? (references.length ? 'bridge' : 'centre') : 'none', references }
}

export function designNote(design) {
  const base = 'log2 protein-group intensity (decoys and contaminants removed), centred on each sample’s median'
  if (design.mode === 'bridge') {
    return `Values: ${base}, then taken as a ratio to the pooled reference channel of the same plex; ` +
      `the ${design.references.length.toLocaleString()} reference channels themselves are left out.`
  }
  if (design.mode === 'centre') {
    return `Values: ${base}, then centred on each protein’s mean within its plex (no pooled reference channel is annotated).`
  }
  return `Values: ${base}.`
}

// --- SQL -----------------------------------------------------------------------

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
const list = (xs) => xs.map(lit).join(', ')
const withSql = (ctes, select) => `WITH ${ctes.join(',\n')}\n${select}`

// m(prot, sample, plex, v): log2 intensity of a protein group in a sample; a
// multiplexed pg row is one channel (label) of the plex its runs make up.
const BASE = [
  'r AS (SELECT run_file_name, unnest(samples) AS x FROM run)',
  `m AS (SELECT p.anchor_protein AS prot, r.x.sample_accession AS sample, p.grouped_runs[1] AS plex, max(log2(p.intensity)) AS v
  FROM pg p JOIN r ON r.run_file_name = p.grouped_runs[1] AND r.x.label = p.label
  WHERE NOT p.is_decoy AND NOT coalesce(p.contaminant, false) AND p.intensity > 0 GROUP BY 1, 2, 3)`,
]

// The CTEs ending in n(prot, sample, v), the corrected values. `only` is a
// predicate on m.prot that limits the proteins (sample medians still use all).
function valuesCtes(design, only = '') {
  const refs = design.references
  const ctes = [
    ...BASE,
    'med AS (SELECT sample, median(v) AS mv FROM m GROUP BY 1)',
    `c AS (SELECT m.prot, m.sample, m.plex, m.v - med.mv AS v FROM m JOIN med USING (sample)${only ? ` WHERE ${only}` : ''})`,
  ]
  if (design.mode === 'bridge') {
    ctes.push(
      `b AS (SELECT prot, plex, avg(v) AS bv FROM c WHERE sample IN (${list(refs)}) GROUP BY 1, 2)`,
      `k AS (SELECT c.prot, c.sample, c.v - b.bv AS v FROM c JOIN b USING (prot, plex) WHERE c.sample NOT IN (${list(refs)}))`,
    )
  } else if (design.mode === 'centre') {
    ctes.push('k AS (SELECT prot, sample, v - avg(v) OVER (PARTITION BY prot, plex) AS v FROM c)')
  } else {
    ctes.push('k AS (SELECT prot, sample, v FROM c)')
  }
  // a sample measured in several runs (technical replicates) gets their mean
  ctes.push('n AS (SELECT prot, sample, avg(v) AS v FROM k GROUP BY 1, 2)')
  return ctes
}

// One row per sample: the values of the most variable proteins quantified in
// every sample, in one fixed protein order; `complete` counts all such proteins.
export function matrixSql(design, top = PCA_PROTEINS) {
  return withSql([
    ...valuesCtes(design),
    'ns AS (SELECT count(DISTINCT sample) AS total FROM n)',
    'whole AS (SELECT prot, var_samp(v) AS s2 FROM n GROUP BY prot HAVING count(*) = (SELECT total FROM ns))',
    `top AS (SELECT prot, row_number() OVER (ORDER BY s2 DESC, prot) AS i FROM whole QUALIFY i <= ${top})`,
  ], 'SELECT n.sample, list(round(n.v, 4) ORDER BY top.i) AS v, (SELECT count(*) FROM whole) AS complete\n' +
    'FROM n JOIN top USING (prot) GROUP BY n.sample ORDER BY n.sample')
}

// Proteins by the number of samples they are quantified in (before any
// correction; pooled references left out), and the number of samples.
export function completenessSql(design) {
  const notRef = design.references.length ? ` WHERE sample NOT IN (${list(design.references)})` : ''
  return withSql([
    ...BASE,
    `q AS (SELECT prot, sample FROM m${notRef} GROUP BY 1, 2)`,
  ], 'SELECT k, count(*) AS proteins, (SELECT count(DISTINCT sample) FROM q) AS samples\n' +
    'FROM (SELECT prot, count(*) AS k FROM q GROUP BY prot) GROUP BY k ORDER BY k')
}

// Per protein and group (A or B): observed values, mean and variance, as lists.
export function compareSql(design, a, b) {
  return withSql([
    ...valuesCtes(design),
    `g AS (SELECT prot, CASE WHEN sample IN (${list(a)}) THEN 'A' ELSE 'B' END AS grp, count(*) AS k, avg(v) AS mu, var_samp(v) AS s2
  FROM n WHERE sample IN (${list([...a, ...b])}) GROUP BY 1, 2)`,
  ], 'SELECT grp, list(prot ORDER BY prot) AS prot, list(k ORDER BY prot) AS k, list(round(mu, 5) ORDER BY prot) AS mu,\n' +
    '  list(round(s2, 6) ORDER BY prot) AS s2 FROM g GROUP BY grp')
}

// One protein's value in each sample.
export function proteinSql(design, prot) {
  return withSql(valuesCtes(design, `m.prot = ${lit(prot)}`), 'SELECT sample, round(v, 4) AS v FROM n ORDER BY sample')
}

// The proteins whose values follow (or mirror) one protein's across samples:
// Pearson r over the samples both are quantified in, at least MIN_SHARED and
// half of the protein's own; the `top` strongest of each sign.
export function coexpressionSql(design, prot, top = 10) {
  return withSql([
    ...valuesCtes(design),
    `x AS (SELECT sample, v FROM n WHERE prot = ${lit(prot)})`,
    `y AS (SELECT n.prot, corr(n.v, x.v) AS r, count(*) AS k FROM n JOIN x USING (sample) WHERE n.prot <> ${lit(prot)}
  GROUP BY n.prot HAVING count(*) >= greatest(${MIN_SHARED}, 0.5 * (SELECT count(*) FROM x)))`,
  ], `SELECT prot, round(r, 4) AS r, k FROM y WHERE isfinite(r)\n` +
    `QUALIFY row_number() OVER (PARTITION BY r > 0 ORDER BY abs(r) DESC) <= ${top} ORDER BY r DESC`)
}

// The proteins named by accession, entry name or gene (any case), with their
// value in each sample; `matched` lists the names that matched each.
export function heatmapSql(design, names) {
  return withSql([
    `ids AS (SELECT prot, unnest(list_concat([prot, split_part(prot, '|', 2)], coalesce(pg_names, []::VARCHAR[]), coalesce(gg_names, []::VARCHAR[]))) AS id
  FROM (SELECT DISTINCT anchor_protein AS prot, pg_names, gg_names FROM pg WHERE NOT is_decoy))`,
    `hit AS (SELECT prot, array_agg(DISTINCT id) AS ids FROM ids WHERE upper(id) IN (${list(names.map((x) => x.toUpperCase()))}) GROUP BY prot)`,
    ...valuesCtes(design, 'm.prot IN (SELECT prot FROM hit)'),
  ], 'SELECT n.prot, any_value(hit.ids) AS matched, list(n.sample ORDER BY n.sample) AS samples, list(round(n.v, 4) ORDER BY n.sample) AS v\n' +
    'FROM n JOIN hit USING (prot) GROUP BY n.prot ORDER BY n.prot')
}

// A display name per protein group: its gene, else its UniProt entry name.
export const NAMES_SQL = 'SELECT list(prot ORDER BY prot) AS prot, list(name ORDER BY prot) AS name FROM ' +
  '(SELECT anchor_protein AS prot, any_value(coalesce(gg_names[1], pg_names[1])) AS name FROM pg WHERE NOT is_decoy GROUP BY 1)'

// --- statistics ------------------------------------------------------------------

// ln Γ(x), Lanczos approximation (g = 7, 9 terms).
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
function lnGamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
  const z = x - 1
  let s = LANCZOS[0]
  for (let i = 1; i < 9; i++) s += LANCZOS[i] / (z + i)
  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(s)
}

// Continued fraction of the incomplete beta function (modified Lentz).
function betaFraction(a, b, x) {
  const tiny = 1e-300
  let c = 1
  let d = 1 - ((a + b) * x) / (a + 1)
  d = 1 / (Math.abs(d) < tiny ? tiny : d)
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    for (const num of [(m * (b - m) * x) / ((a + m2 - 1) * (a + m2)), (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1))]) {
      d = 1 + num * d
      d = 1 / (Math.abs(d) < tiny ? tiny : d)
      c = 1 + num / c
      if (Math.abs(c) < tiny) c = tiny
      h *= d * c
    }
    if (Math.abs(d * c - 1) < 1e-15) break
  }
  return h
}

// Regularised incomplete beta function I_x(a, b).
export function incompleteBeta(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2)
    ? (front * betaFraction(a, b, x)) / a
    : 1 - (front * betaFraction(b, a, 1 - x)) / b
}

// Two-sided p-value of Student's t with `df` degrees of freedom.
export const tTwoSided = (t, df) => incompleteBeta(df / (df + t * t), df / 2, 0.5)

// Welch's t-test from group summaries { k, mu, s2 }; null when both variances are 0.
export function welch(a, b) {
  const va = a.s2 / a.k
  const vb = b.s2 / b.k
  const se2 = va + vb
  if (!(se2 > 0)) return null
  const t = (a.mu - b.mu) / Math.sqrt(se2)
  const df = (se2 * se2) / ((va * va) / (a.k - 1) + (vb * vb) / (b.k - 1))
  return { t, df, p: tTwoSided(t, df) }
}

// Benjamini–Hochberg adjusted p-values, in the input order.
export function benjaminiHochberg(ps) {
  const order = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0])
  const out = new Array(ps.length)
  let min = 1
  for (let r = order.length - 1; r >= 0; r--) {
    min = Math.min(min, (order[r][0] * order.length) / (r + 1))
    out[order[r][1]] = min
  }
  return out
}

// Group A against group B from compareSql's rows: a Welch test per protein with
// at least MIN_GROUP values in each group, BH-adjusted; proteins seen in only one
// group (MIN_GROUP or more values there, none in the other) are listed apart.
export function compareGroups(rows) {
  const byGroup = { A: new Map(), B: new Map() }
  for (const r of rows) {
    const [grp, prot, k, mu, s2] = Array.isArray(r) ? r : [r.grp, r.prot, r.k, r.mu, r.s2]
    prot.forEach((p, i) => byGroup[grp].set(p, { k: k[i], mu: mu[i], s2: s2[i] }))
  }
  const tested = []
  const onlyA = []
  const onlyB = []
  let untested = 0
  for (const prot of new Set([...byGroup.A.keys(), ...byGroup.B.keys()])) {
    const a = byGroup.A.get(prot)
    const b = byGroup.B.get(prot)
    const res = a && b && a.k >= MIN_GROUP && b.k >= MIN_GROUP ? welch(a, b) : null
    if (res) tested.push({ protein: prot, log2fc: a.mu - b.mu, t: res.t, df: res.df, p_value: res.p, n_a: a.k, n_b: b.k, mean_a: a.mu, mean_b: b.mu })
    else if (a && !b && a.k >= MIN_GROUP) onlyA.push({ protein: prot, n_a: a.k, mean_a: a.mu })
    else if (b && !a && b.k >= MIN_GROUP) onlyB.push({ protein: prot, n_b: b.k, mean_b: b.mu })
    else untested++
  }
  const adj = benjaminiHochberg(tested.map((r) => r.p_value))
  tested.forEach((r, i) => { r.adj_pvalue = adj[i] })
  tested.sort((x, y) => x.p_value - y.p_value)
  onlyA.sort((x, y) => y.n_a - x.n_a || y.mean_a - x.mean_a)
  onlyB.sort((x, y) => y.n_b - x.n_b || y.mean_b - x.mean_b)
  return { tested, onlyA, onlyB, untested }
}

// --- sample map ---------------------------------------------------------------

// Principal components of samples × proteins (complete, no missing values):
// proteins centred, the samples' Gram matrix decomposed by orthogonal iteration.
// Returns each sample's scores and each component's share of the variance.
export function pca(rows, k = 3) {
  const n = rows.length
  const p = n ? rows[0].length : 0
  k = Math.min(k, n - 1, p)
  if (k < 1) return { scores: rows.map(() => []), explained: [] }
  const mean = new Float64Array(p)
  for (const r of rows) for (let j = 0; j < p; j++) mean[j] += r[j] / n
  const X = rows.map((r) => Float64Array.from(r, (v, j) => v - mean[j]))
  const G = X.map(() => new Float64Array(n))
  let trace = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0
      for (let c = 0; c < p; c++) s += X[i][c] * X[j][c]
      G[i][j] = s
      G[j][i] = s
    }
    trace += G[i][i]
  }
  // deterministic start: the first k samples' rows of G
  let Q = Array.from({ length: k }, (_, c) => Float64Array.from(G[c]))
  orthonormalise(Q)
  let values = new Array(k).fill(0)
  for (let iter = 0; iter < 500; iter++) {
    const Z = Q.map((q) => multiply(G, q))
    const next = Z.map((z, c) => dot(z, Q[c]))
    orthonormalise(Z)
    Q = Z
    const done = next.every((v, c) => Math.abs(v - values[c]) <= 1e-10 * Math.abs(v))
    values = next
    if (done) break
  }
  // a fixed sign: the sample furthest out on each component is on its positive side
  Q.forEach((q) => {
    let far = 0
    for (let i = 1; i < n; i++) if (Math.abs(q[i]) > Math.abs(q[far])) far = i
    if (q[far] < 0) for (let i = 0; i < n; i++) q[i] = -q[i]
  })
  const scale = values.map((v) => Math.sqrt(Math.max(0, v)))
  return {
    scores: rows.map((_, i) => Q.map((q, c) => q[i] * scale[c])),
    explained: values.map((v) => (trace > 0 ? v / trace : 0)),
  }
}

function dot(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}
function multiply(G, q) {
  return Float64Array.from(G, (row) => dot(row, q))
}
function orthonormalise(Q) {
  Q.forEach((q, c) => {
    for (let d = 0; d < c; d++) {
      const s = dot(q, Q[d])
      for (let i = 0; i < q.length; i++) q[i] -= s * Q[d][i]
    }
    const norm = Math.sqrt(dot(q, q)) || 1
    for (let i = 0; i < q.length; i++) q[i] /= norm
  })
}

// Pearson correlation between every pair of rows (samples).
export function correlationMatrix(rows) {
  const Z = rows.map((r) => {
    const m = r.reduce((a, v) => a + v, 0) / r.length
    const c = Float64Array.from(r, (v) => v - m)
    const norm = Math.sqrt(dot(c, c)) || 1
    return c.map((v) => v / norm)
  })
  const r = Z.map(() => new Array(Z.length).fill(1))
  for (let i = 0; i < Z.length; i++) for (let j = 0; j < i; j++) r[i][j] = r[j][i] = dot(Z[i], Z[j])
  return r
}
