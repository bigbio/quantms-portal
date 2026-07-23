# Gap Finder

The Gap Finder turns coverage into action. For a chosen organism (`?mode=gaps&organism=…`)
it shows the coverage metrics and three actionable gap lists.

## Coverage (two denominators)

The metric cards report quantms and PeptideAtlas coverage against **both** the Swiss-Prot
reviewed set and the full proteome, with the pinned reference-proteome id shown alongside —
so the numbers are directly comparable and a change in the reference set never silently
shifts them. See [Evidence tiers & denominators](/docs/compass-tiers) for what each
denominator means and how "quantms coverage = passing GPP" is defined.

## Unobserved reviewed proteins

The primary, always-available gap: **Swiss-Prot (reviewed) proteins quantms has not yet
detected**, ranked by UniProt PE level (PE1 first — the most important to detect). This is
the *reanalysis headroom* itemized. It is derived from UniProt + quantms alone, so it works
for **every organism** — including the many that have no PeptideAtlas build — and its length
equals the headroom number on the coverage cards. Each row links out to quantms Peptide
Search, PeptideAtlas, and UniProt.

## Reanalysis targets

Proteins **PeptideAtlas observes but quantms does not** (evidence tier **T4**), ranked by
PeptideAtlas sample count × tissue breadth. These are the highest-value studies to
reprocess — re-running the datasets that contain them is the most direct way to close the
coverage gap, and the list excludes proteins already reanalyzed, so it doubles as a work
queue. This gap is **PeptideAtlas-derived**, so it is empty for organisms without a
PeptideAtlas build; the view says so explicitly rather than implying "nothing to do".

## PE-upgrade candidates

MS-confirmed proteins (tier **T2**) whose UniProt PE level is below 1, that meet the
**HPP 3.0** bar — ≥2 unique ≥9-aa peptides across ≥2 datasets, class-1 FDR, USI-referenced.
These are *candidates* for a protein-existence upgrade, framed conservatively. This gap also
requires the PeptideAtlas axis and HPP-grade evidence, so it too is currently human-centric.

## Tissue gaps

Where HPA reports a protein expressed in a tissue that quantms has not observed there —
tissue names reconciled to UBERON/BTO across the resources, with the unmapped rate shown
as a quality metric.
