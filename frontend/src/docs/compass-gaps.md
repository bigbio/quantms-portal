# Gap Finder

The Gap Finder turns coverage into action. For a chosen organism it shows the corpus
metrics, the reanalysis queue, and the PE-upgrade candidates.

## Coverage (one denominator)

Every percentage uses the **same UniProt reference proteome** as the denominator, and
that pinned proteome id is displayed alongside — so "62% covered by quantms" and "71% by
PeptideAtlas" are directly comparable, and a change in the reference set never silently
shifts the numbers.

## Reanalysis targets

Proteins **PeptideAtlas observes but quantms does not** (evidence tier **T4**), ranked by
PeptideAtlas sample count × tissue breadth. These are the highest-value datasets to
reprocess: re-running the studies that contain them is the most direct way to close the
coverage gap. The list excludes proteins already reanalyzed, so it doubles as a work queue.

## PE-upgrade candidates

MS-confirmed proteins (tier **T2**) whose UniProt PE level is below 1, that meet the
**HPP 3.0** bar — ≥2 unique ≥9-aa peptides across ≥2 datasets, class-1 FDR, USI-referenced.
These are *candidates* for a protein-existence upgrade, framed conservatively.

## Tissue gaps

Where HPA reports a protein expressed in a tissue that quantms has not observed there —
tissue names reconciled to UBERON/BTO across the resources, with the unmapped rate shown
as a quality metric.
