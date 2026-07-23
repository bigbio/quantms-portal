# Explorer & taxonomy

The Explorer is a faceted set-query tool over every protein in the corpus. Compose
filters across the evidence dimensions, or click a **preset** for a named set query:

- **In PA, not quantms (T4)** — the reanalysis frontier.
- **In quantms, not PA (T3)** — quantms-unique observations.
- **PE-upgrade candidates (T2)** — MS-confirmed, PE below 1.
- **Dark proteins (T6)** — no MS evidence anywhere.
- **Unobserved reviewed (`swissprot_gap`)** — Swiss-Prot proteins quantms hasn't detected;
  PeptideAtlas-independent, so it works for any organism.

The filtered view is captured in the URL, so any set query is shareable and reproducible,
and the result set can be exported as CSV or Parquet.

## Taxonomy scope

The corpus spans many species. The taxonomy tree lets you browse the clade hierarchy
(superkingdom → … → species) with per-node protein counts and coverage, and **scope any
facet query to a clade** — e.g. "reanalysis targets across all Bacteria" — by narrowing to
a subtree.
