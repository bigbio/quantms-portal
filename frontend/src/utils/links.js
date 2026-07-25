// Shared cross-resource link builders (UniProt, PeptideAtlas, quantms peptide-search).
// Every accession is URL-encoded so a stray character can never break the URL or
// inject markup — this is the single source of truth for these URLs.

// Canonical UniProtKB entry page for an accession.
export function uniprotUrl(acc) {
  return `https://www.uniprot.org/uniprotkb/${encodeURIComponent(acc)}/entry`
}

// PeptideAtlas global protein search for an accession.
export function peptideAtlasUrl(acc) {
  return `https://db.systemsbiology.net/sbeams/cgi/PeptideAtlas/Search?action=GO&search_key=${encodeURIComponent(acc)}&search_scope=Global`
}

// Internal client-side path to the peptide-search app in protein mode. Returned
// as a string that vue-router's <router-link :to> accepts directly.
export function quantmsPeptideSearchPath(acc) {
  return `/apps/peptide-search?mode=protein&query=${encodeURIComponent(acc)}`
}
