// Shared, page-lifetime cache for the peptide-search /stats document. Several
// components need it (the Peptide Search ribbon and GPP default, and the
// ProteinProfile observation distribution); this module makes sure it is
// fetched once. A failed fetch is not cached so a later caller can retry.
import { apiGet } from '../api.js'
import { PEPTIDE_SEARCH_BASE } from '../config.js'

let statsPromise = null

export function getPeptideStats() {
  if (!statsPromise) {
    statsPromise = apiGet(PEPTIDE_SEARCH_BASE, '/stats').catch((e) => {
      statsPromise = null
      throw e
    })
  }
  return statsPromise
}

// Test hook: forget the cached document.
export function resetPeptideStatsCache() {
  statsPromise = null
}
