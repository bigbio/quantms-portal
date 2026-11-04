// qpx-explore client: query one content-addressed qpx dataset with DuckDB.
//
// The backend lives at api.quantms.org/qpx-explore and is addressed per dataset
// by a `ref` of the form "{accession}/{phash}" (e.g. MSV000085836/8e4c044b513d),
// URL-encoded via encodePath. Reads are GETs; the SQL editor POSTs a
// SELECT that the backend validates and confines to the dataset.

import { apiGet as get, apiPost as post, encodePath } from './api.js'
import { QPX_BASE } from './config.js'
import { NAMES_SQL } from './qpxAnalysis.js'

// A first query over a large dataset reads Parquet from S3 and can take tens of seconds.
const SLOW = { timeout: 60000 }
const apiGet = (base, path, params, opts) => get(base, path, params, { ...SLOW, ...opts })
const apiPost = (base, path, body, opts) => post(base, path, body, { ...SLOW, ...opts })

// Dataset-level summary: files present, views available, row counts, organisms, instruments.
export const qpxOverview = (ref) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/overview`)

export const qpxRuns = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/runs`, params)
export const qpxSamples = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/samples`, params)

// Search protein groups / peptides (both accept an optional text filter `q`).
export const qpxSearchProteins = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/proteins`, params)
export const qpxSearchPeptides = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/peptides`, params)

// One protein group: its pg row plus the supporting peptides.
export const qpxProtein = (ref, protein) =>
  apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/protein/${encodeURIComponent(protein)}`)

// Per-run abundance (summed feature intensity) for one protein group.
export const qpxProteinExpression = (ref, protein) =>
  apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/protein/${encodeURIComponent(protein)}/expression`)

// Search peptidoform features with filters (q text, charge, run, qvalue_max, mod).
export const qpxSearchFeatures = (ref, params) =>
  apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/features`, params)

// PTM (post-translational modification) distribution for the dataset.
export const qpxPtms = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/ptms`, params)

// Browse scan-level spectral evidence from the psm table (raw peak lists are not
// stored in the parquet — this surfaces the scan/precursor metadata that is).
export const qpxPsms = (ref, params) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/psms`, params)

// Expose each available view's columns+types (backing the SQL editor).
export const qpxSchema = (ref) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/schema`)

// Run a free-form, SELECT-only DuckDB statement (validated + confined backend-side).
export const qpxRunSql = (ref, { sql, limit }) =>
  apiPost(QPX_BASE, `/datasets/${encodePath(ref)}/sql`, { sql, limit })

// One overview statistic: summary, per_run, charge, length, missed_cleavages or metadata.
export const qpxStats = (ref, part) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/stats/${part}`)

// Dataset QC: 'runs' (per-run metrics) or 'samples' (per-sample protein intensity), with outlier flags.
// Per-run QC scans every feature: about 70 s on the largest dataset (229M features).
export const qpxQc = (ref, part) => apiGet(QPX_BASE, `/datasets/${encodePath(ref)}/qc/${part}`, undefined, { timeout: 180000 })

// --- analyses ------------------------------------------------------------------
// The Explorer's analyses (qpxAnalysis.js) each scan a whole dataset. The backend
// runs only a few SQL queries at once and turns more away as busy, so the page
// sends at most two at a time and retries a query turned away once.
const BUSY = /too many SQL queries/i
const MAX_RUNNING = 2
let running = 0
const waiting = []

export async function qpxAnalysisSql(ref, sql) {
  if (running >= MAX_RUNNING) await new Promise((resolve) => waiting.push(resolve))
  running++
  const run = () => apiPost(QPX_BASE, `/datasets/${encodePath(ref)}/sql`, { sql, limit: 2000 }, { timeout: 180000 })
  try {
    try {
      return await run()
    } catch (e) {
      if (!BUSY.test(e.message)) throw e
      await new Promise((resolve) => setTimeout(resolve, 3000))
      return await run()
    }
  } finally {
    running--
    if (waiting.length) waiting.shift()()
  }
}

// Protein group -> display name (gene, else UniProt entry name), once per dataset.
const names = new Map()
export function qpxProteinNames(ref) {
  if (!names.has(ref)) {
    names.set(ref, qpxAnalysisSql(ref, NAMES_SQL).then((d) => {
      const [prot, name] = (d.rows && d.rows[0]) || [[], []]
      return new Map(prot.map((p, i) => [p, name[i]]))
    }).catch((e) => { names.delete(ref); throw e }))
  }
  return names.get(ref)
}
