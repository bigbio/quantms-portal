# Evidence tiers & denominators

Every protein in Compass is reconciled to one **evidence tier** and reported against
**two denominators**. Both are deliberate choices — this page defines them precisely.

## The two denominators

Coverage is always ambiguous unless you say "coverage of *what*". Compass reports both:

- **Swiss-Prot (reviewed)** — the manually curated, canonical proteins. This is the
  denominator most biologists mean by "the proteome" (e.g. ~20,400 for human). It is the
  fairest target for "how complete is our detection".
- **Full proteome (Swiss-Prot + TrEMBL)** — every entry in the UniProt reference proteome,
  including unreviewed and predicted TrEMBL records (e.g. ~147,500 for human). A percentage
  on this denominator is much smaller, because TrEMBL is dominated by isoforms and
  computationally predicted entries that no method fully covers.

The pinned reference-proteome id (e.g. `UP000005640`) is shown next to the numbers so a
change in the reference set never silently shifts the percentages. When you read a coverage
figure, check which denominator it is on: "66% of Swiss-Prot" and "9% of the full proteome"
can be the same organism.

## quantms coverage = "passing GPP"

A protein counts as **observed by quantms** when at least one of its peptides passes the
**Global Peptide Probability (GPP)** gate across the corpus — this is the same GPP used in
Peptide Search. `n_gpp_passing` is the count of quantms-observed proteins. Note it counts
*all* quantms-observed proteins (including TrEMBL), so it is not identical to the Swiss-Prot
coverage numerator; the Swiss-Prot coverage percentage uses only the Swiss-Prot ∩ quantms
intersection.

## The evidence tiers (T1–T6)

Each protein is placed in exactly one tier by combining the MS axis (quantms + PeptideAtlas)
with the orthogonal axis (UniProt PE + HPA RNA):

| Tier | Meaning |
|---|---|
| **T1** | Multi-resource confirmed — quantms **and** PeptideAtlas-canonical **and** UniProt PE1 |
| **T2** | MS-confirmed, PE-upgrade candidate — quantms + PeptideAtlas, but PE below 1 or PA non-canonical |
| **T3** | quantms-unique MS — quantms observes it, PeptideAtlas does not |
| **T4** | PeptideAtlas-only MS — PeptideAtlas observes it, quantms does not (a reanalysis target) |
| **T5** | Transcript / other only — no MS, but HPA RNA expression or UniProt PE2/PE3 |
| **T6** | **Dark** — no MS anywhere, no RNA support; typically UniProt PE4/PE5 |

Reading the ladder: **T1** is the strongest ("everyone sees it"), **T3/T4** are the
disagreements between the two MS resources (and the richest source of action), **T5** is
non-MS evidence only, and **T6** is the dark proteome — entries that exist in the reference
largely on prediction.

**Caveat on T6 for non-human organisms.** T6 depends on the non-MS axes being populated. The
HPA RNA axis and dense UniProt PE annotation are strongest for human, so for organisms without
an HPA build a protein can land in T6 simply because the RNA axis is absent — not because it
is truly dark. Treat T6 as fully meaningful for human and as a coarse signal elsewhere.

## MS-circularity

quantms and PeptideAtlas are both mass spectrometry. Where they agree, Compass labels the
concordance **"MS-concordant, not independent"** — it is *not* orthogonal corroboration. The
independent axis is UniProt PE / HPA. This is why a T1 protein requires PE1 (a non-MS
signal), not just two MS resources agreeing.
