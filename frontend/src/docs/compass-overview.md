# Proteome Compass — Overview

Proteome Compass places **quantms's own mass-spec evidence** for a protein next to
three orthogonal resources — **PeptideAtlas**, **UniProt protein-existence (PE)**, and
the **Human Protein Atlas (HPA)** — on one record, for every protein in every corpus
organism. It makes the **gaps** first-class, queryable objects: where quantms is behind
(a protein PeptideAtlas sees but quantms doesn't), where it's ahead (quantms-unique), and
where an MS-confirmed protein could upgrade its UniProt PE level.

## What it answers

- **How much of each proteome do we cover?** — % of the UniProt reference proteome
  observed by quantms vs PeptideAtlas, always on the *same* denominator (the pinned
  reference proteome is shown next to every %).
- **What should we reanalyze next?** — the ranked list of proteins PeptideAtlas observes
  that quantms does not (the reanalysis targets that close coverage gaps).
- **Which proteins are PE-upgrade candidates?** — MS-confirmed proteins whose UniProt PE
  is below 1, framed by HPP 3.0 rigor.

## How it's built

Static-first, like the rest of the portal: per-release batch jobs fetch and pin each
source (UniProt, PeptideAtlas builds, HPA, NCBI taxonomy), join them onto the UniProt
identity spine, reconcile each protein into an **evidence tier (T1–T6)** with gap flags,
and publish immutable Parquet artifacts. A stateless pod pool queries them directly over
S3 and serves REST + MCP.

## A note on honesty

quantms and PeptideAtlas are *both* mass spectrometry, so their agreement is labeled
**"MS-concordant, not independent"** — UniProt-PE and HPA are kept as the orthogonal
(non-MS) axis. Coverage in sparse (single-dataset) organisms is reported with the number
of contributing datasets always visible, never dressed up as more than it is.
