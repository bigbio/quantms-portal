# Concepts

A short glossary of the core ideas the portal is built on. Each links to a deeper page.

## Corpus

The **corpus** is the full set of identifications the portal indexes — peptides and proteins
observed across every reanalyzed dataset, harmonized to one schema so they can be searched and
counted together. It is the shared substrate every app queries. See [The data](/docs/data).

## Dataset

A **dataset** is one reanalyzed study (typically originating from a public ProteomeXchange/PRIDE
submission) after it has been reprocessed through the standardized quantms pipeline. Each dataset
has a **content-addressed identity** — its address is derived from the content it contains, so the
same reprocessing always yields the same address and re-runs are deduplicated. A dataset carries
metadata (organism, tissue, disease, instrument, source study) that drives the search facets. See
[The data → content-addressed dataset identity](/docs/data).

## Collection

A **collection** is a named, curated group of datasets — a way to bundle studies that belong
together (for example, a body-map, a disease cohort, or a reanalysis project) so they can be
browsed and searched as a unit. A dataset can belong to more than one collection. See
[Collections](/docs/collections).

## Peptide, peptidoform & protein identity

- A **peptide** is a bare amino-acid sequence; a **peptidoform** is a peptide with its specific
  modifications and their sites.
- Protein identity is **gene-centric**: a UniProt accession, its mnemonic, and its gene name all
  resolve to the same protein, so counts stay consistent no matter which identifier a study used.
  See [How search works → mapping](/docs/ps-how-search-works).

## Evidence & GPP

Every observation is a piece of **evidence**. Because aggregating hundreds of independently
FDR-controlled studies compounds their false positives, the portal scores each observation with
**GPP — the Global Peptide Probability**, a decoy-free, reproducibility-calibrated probability
that a detection is real. See [Evidence quality (GPP)](/docs/ps-gpp).

## App

An **app** is a focused query surface over the same corpus — Peptide & Protein Search, Dataset
Search, Statistics. Every app is available both as a web view and as **MCP tools** for AI agents,
running the identical queries. See [Applications](/docs/applications) and [AI & MCP](/docs/ai-mcp).
