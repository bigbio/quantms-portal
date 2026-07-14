# Evidence quality

The portal aggregates identifications from **~232 datasets**. Each one was
FDR-controlled to about **1% locally** — a reasonable standard for a single study.
But aggregation changes the math. When you pile 232 studies together, those local
1% false-positive rates compound, and "sticky" false identifications accumulate:
the same implausible detection passes FDR in study after study and shows up looking
like a real, reproducible signal.

The **evidence quality score** (`qc_score`) is how the portal deals with this. It is
a per-observation confidence lens over the existing evidence — a way to ask *"how
likely is this particular detection to be real?"* — without re-searching anything and
without hiding data by default.

*(FDR = false discovery rate, the expected fraction of identifications that are wrong
at a given threshold.)*

## The problem, made concrete

Take **SPANXN5**, a sperm- and testis-specific protein. Across the aggregated corpus
it appears with **8 observations in brain vs. 1 in testis** — the opposite of its
known biology. And this is not a shared-peptide artifact: the evidence comes from
**2 unique peptides**, so it is not a case of one peptide being mis-attributed
between similar proteins. The most likely explanation is that the brain evidence is
false identifications or contamination — each of which passed local FDR in its own
study, and none of which would survive if we asked whether the detection is
biologically and statistically credible across the whole corpus.

The portal does **not** re-control FDR at the aggregate level. Instead it scores each
piece of evidence individually, so implausible detections like the brain SPANXN5 rows
can be down-weighted while the real testis detection is kept.

## What the QC score is

Every piece of evidence gets a **`qc_score` between 0 and 1** — a label-free
probability that the detection is true. It is:

- **Computed once, at indexing time**, and stored on each evidence row. It adds no
  latency to search.
- **Off by default.** Unless you turn it on, searches behave exactly as before and
  show all evidence. Turning it on applies a "high-confidence only" filter that hides
  evidence below a cutoff.
- **A quality lens, not access control.** It does not delete data, does not re-run
  identification, and does not gate who can see what. It re-ranks and optionally
  filters evidence you already have.

## How the score is computed

The score combines several **orthogonal signals** — each capturing a different reason
to trust or doubt a detection — into a single probability. The signals are added
together in **log-odds** (evidence-for-minus-evidence-against) space, and the summed
score is then **calibrated into a real 0–1 probability** by fitting a two-component
mixture (a "true" and a "false" population) to the overall score distribution. This
is the same idea behind **PeptideProphet**, and it needs **no decoys**.

Every signal is **optional**: if the information needed for a signal is missing for a
given peptide, that signal is simply left out — it is never counted as a penalty.

| Signal | What it measures |
| --- | --- |
| **Reproducibility** | How many **independent datasets and samples** the peptide appears in. This is the strongest signal by far: seeing a peptide in N different studies is far more convincing than seeing it N times in one. |
| **Proteotypicity** | Whether the peptide maps uniquely to a single gene. *(A proteotypic peptide is one that belongs to only one protein/gene, so its evidence is unambiguous.)* |
| **Peptide length** | Longer peptides are more specific. Peptides of **≥ 9 amino acids** — an **HPP** guideline — are more trustworthy. *(HPP = the Human Proteome Project, which sets community standards for confident protein identification.)* |
| **Protein coverage** | How much of the protein sequence has been observed. More coverage ⇒ more credible. |
| **Run depth × protein rarity** | Identifications come out roughly in **abundance order**, so a rare protein seen only in shallow runs is suspicious, while the same protein seen in deep runs is expected. |
| **Tissue plausibility** | A soft biological prior from **Human Protein Atlas** RNA expression. Evidence in a tissue where the gene is transcriptionally silent is down-weighted; evidence in a tissue where the gene is expressed is kept. An unmapped or unknown tissue is **neutral** — never penalized. |

Tissue plausibility is what fixes SPANXN5: brain is transcriptionally silent for this
gene, so the brain evidence is down-weighted, while testis (where the gene is
expressed) is kept.

## Which signals matter most — and the safety property

**Reproducibility dominates.** Its contribution grows with the number of datasets a
peptide is seen in and is effectively **unbounded** — the more independent studies,
the stronger the vote for "true." By contrast, the tissue-plausibility and
protein-existence priors are deliberately **bounded and small**.

The practical consequence is a reassuring safety property: **a peptide with strong
support is essentially never discarded just because a biological database disagrees
about its tissue.** If a peptide has many identifications, good scores, and appears in
many datasets, no amount of "Human Protein Atlas says this tissue is silent" or
"UniProt is unsure about this protein" will filter it out. The reproducibility signal
simply outweighs those priors.

Concretely: **peptidoforms seen in 10 or more datasets are filtered only 0.3% of the
time.**

| Evidence seen in… | Chance it's filtered (default cutoff) |
| --- | --- |
| 1 dataset | ~98% |
| 2 datasets | ~77% |
| 3–4 datasets | ~43% |
| 5–9 datasets | ~14% |
| 10+ datasets | ~0.3% |

## Does it actually work?

To check that `qc_score` measures something real, we validated it against an
**independent** yardstick: **UniProt Protein Existence (PE)** levels. PE is UniProt's
own rating of how well-established a protein is, and it is derived independently of
this corpus:

- **PE1** — protein-level evidence exists
- **PE2** — transcript evidence only
- **PE3** — inferred from homology
- **PE4** — predicted
- **PE5** — uncertain / dubious

If the QC score is meaningful, it should be high for well-established proteins and low
for shaky ones. It tracks PE strongly:

| PE level | median `qc_score` |
| --- | --- |
| PE1 (protein evidence) | 0.99 |
| PE2 (transcript only) | 0.003 |
| PE3 (homology) | 0.005 |
| PE4 (predicted) | 0.008 |
| PE5 (uncertain) | 0.030 |

The **default cutoff is 0.15**, chosen to sit in the gap between these populations. At
that cutoff, the filter keeps about **87% of protein-evidence (PE1)** rows while
removing about **74% of transcript- or predicted-only (PE2/PE4/PE5)** evidence.

## What the filter removes across the corpus

Across the full corpus of **~23.8 million evidence rows**, the default cutoff keeps
about **62%** and removes about **38%**. Broken down by protein-existence level, the
removal lands overwhelmingly on the weakly-supported proteins:

| PE level | proteins | evidence rows | median `qc_score` | kept at default |
| --- | --- | --- | --- | --- |
| PE1 | 33,586 | 8.9M | 0.99 | 87% |
| PE2 | 518 | 2,243 | 0.003 | 12% |
| PE3 | 378 | 1,281 | 0.005 | 21% |
| PE4 | 36 | 134 | 0.008 | 31% |
| PE5 | 386 | 3,068 | 0.030 | 36% |

The well-established proteome is almost entirely preserved, while the long tail of
transcript-only, homology-based and predicted proteins is heavily pruned.

## Interesting cases: high scores despite low UniProt existence

Some proteins that UniProt marks as low-existence (PE3–PE5) still score **high**. This
is not a bug, and it's worth being honest about what it means.

Nearly all of these fall into two groups:

- **Pseudogenes** (e.g. *EEF1A1P5*, *CHCHD2P9*, *RPL13AP3*, *HSP90AB4P*) whose peptides
  are **shared with very abundant parent proteins**. The peptides are genuinely
  detected — that part is real — but the *attribution* of that detection to the
  pseudogene, rather than to its abundant parent, is the subtle part.
- **Immunoglobulin variable-region genes** (the *IGKV* / *IGKJ* families), which are
  genuinely abundant in plasma and serum but are conservatively annotated in UniProt.

So the right way to read a high score here is: **"this peptide is really detected,"**
not automatically **"this specific gene is a newly confirmed protein."** What the QC
score gives you is a useful **shortlist** — it surfaces *which* low-existence proteins
have strong mass-spec support and are worth a closer look. Roughly **54 non-PE1
proteins** have strong high-confidence evidence (≥ 3 datasets and ≥ 2 peptides).

## Using it

### High-confidence only (the toggle)

On the **Peptide & Protein Search**, a **High-confidence only** toggle applies the
calibrated default cutoff (**0.15**). Both the full count and the high-confidence
count are shown side by side, so you can see exactly how much the filter changes a
result before committing to it.

### Advanced cutoff slider

For power users, an **advanced slider** runs from **0.0 to 1.0** and lets you set the
exact cutoff live:

- **0** — show everything (filter off)
- **0.15** — the calibrated default
- **1** — strictest

Results and counts update as you drag, and the cutoff is captured in the **URL**, so a
filtered view is shareable — send someone a link and they see the same evidence at the
same threshold.

### SPANXN5, end to end

- **Filter off:** SPANXN5 shows **8 brain + 1 testis** observations — the biologically
  implausible picture.
- **High-confidence on:** the brain evidence, which is weakly reproducible and lands in
  a transcriptionally silent tissue, drops away, while the **testis** detection — real
  and biologically expected — is kept.

That is the whole point of the score: the same data, seen through a quality lens that
keeps what's credible and steps back the rest.

## Where to find it

The evidence quality filter is available **today** on the Peptide & Protein Search,
via the toggle and the advanced slider. It is also available through the API using the
**`qc`** parameter (turn the filter on) and **`qc_threshold`** (set the cutoff). By
default everything stays off and unfiltered — the score is there when you want a
quality lens, and out of the way when you don't.
