# How search works

This page is a technical deep-dive into the **Peptide & Protein Search** app for
collaborators: how a query resolves to a protein, how observations are counted, how
the coverage map is derived, and how the dataset summaries are written. For the
user-facing tour see [Applications](/docs/applications); for the storage and index
design see [Infrastructure](/docs/infrastructure).

## Mapping — protein identity resolution

The hardest part of protein search is not looking up rows, it is deciding *what
counts as the same protein*. The corpus identifies the same protein inconsistently:
a UniProt accession (`P04040`) in one dataset, its mnemonic (`CATA_HUMAN`) in
another, its gene symbol (`CAT`) in a third. Treating those as three different
proteins double-counts observations and pushes proteome coverage past 100%.

So search is **gene-centric**. A query resolves in a small number of steps:

- **Exact match first.** The query is looked up against the in-memory resolver,
  which holds exact-match maps for accessions, gene symbols and protein-name tokens.
  An exact accession, mnemonic or gene symbol resolves directly to the identifiers
  it refers to.
- **Gene-centric merge.** When a query resolves to a single gene, the search runs
  over **all** of that gene's corpus identifiers — its accessions, mnemonic and gene
  name — as one protein. This is why `P04040`, `CATA_HUMAN` and `CAT` return the
  **same** datasets, and why the protein profile and the dataset-count agree: they
  share the same resolution and therefore the same row set. A query that resolves to
  several genes searches the union of each gene's identifiers.
- **Organism / taxon scoping.** The merge is scoped by organism so that orthologs —
  the "same" gene in different species — are **not** collapsed together. A gene in
  human and its counterpart in mouse remain distinct proteins.
- **Graceful fallback.** When a query has no gene mapping (a partial or substring
  search, or an accession absent from the map), search falls back to accession-level
  identity using a token predicate, so partial searches still return datasets — just
  without the gene-level merge.

The shared gene / name map that powers resolution is produced offline by the
protein-metadata job (built from the UniProt ID-mapping service) and is **optional**
everywhere: if it is missing, every consumer degrades cleanly to accession-only
identity.

## Counting — observations, datasets and proteotypicity

Counts are always derived from the compact index rows, bounded to the rows that
match the query.

- **Observations and datasets.** Each index row carries an observation-count proxy
  and its dataset. A peptide's or protein's totals are the aggregation of those over
  the matching rows: how many observations, and across how many distinct datasets it
  appears.
- **Proteotypic / gene-unique.** A peptide is **gene-proteotypic** when all of the
  proteins it maps to collapse to a single gene. It is computed by joining the small
  accession → gene map onto the target peptide's rows only (bounded work), then
  checking whether those accessions resolve to one gene. An accession with no gene
  in the map falls back to its own identity, so an unmapped protein is still handled
  sensibly. Working at the gene level — rather than the raw accession level — is what
  makes "unique to one protein" mean "unique to one biological gene product".
- **Proteome coverage.** Portal statistics count **distinct genes** per organism,
  the standardized biological unit, rather than raw accessions (which would
  over-count).

## The coverage map — per-residue depth, intensity and PTM sites

The protein sequence coverage map renders, residue by residue along a protein's
**canonical UniProt sequence**, how deeply each position was observed and where its
modifications sit. It is computed per query from pure, unit-testable helpers.

- **Observation depth.** For each distinct observed bare peptide, every occurrence
  of that peptide in the canonical sequence adds the peptide's summed observation
  count to the residues it covers. A peptide that occurs more than once contributes
  at each occurrence; a peptide that does not appear in the sequence is skipped. The
  result is a per-residue depth profile.
- **Normalized intensity.** Depth is log-normalized into a `[0, 1]` intensity — each
  residue's `log1p(depth) / log1p(max_depth)` — so the hottest residue is `1.0` and
  the map is comparable across proteins regardless of absolute observation counts.
  The log scale keeps a few very deeply observed residues from flattening everything
  else.
- **PTM sites at absolute positions.** Each observed peptidoform is parsed into its
  modifications, and each modification is placed at its **absolute 1-based residue
  position** in the protein (the peptide's start offset plus the position within the
  peptide; N- and C-terminal mods clamp to the first/last residue). The residue at
  that position is read from the canonical sequence as ground truth, and sites are
  aggregated to `{position, residue, mods}` with a per-modification dataset count.

The canonical sequences come from the protein-metadata job's sequence artifact,
read on demand. If a protein's sequence is unavailable the coverage map degrades to
"not found" while the scalar coverage percentage still works.

## LLM dataset summaries

Each dataset carries a short, human-readable "what this dataset is about" summary
and a few keyword tags. These are written **offline, in the enrichment job** — never
on the request path. A serving node only ever reads the finished text.

- **What generates them.** A **small local instruct language model** (a compact
  GGUF model run in-process inside the job, CPU-only, no external API or key) turns
  the dataset's metadata into a 1–2 sentence plain-language summary plus 3–6 keyword
  tags, emitted as JSON.
- **What it is given.** Only dataset metadata — the accession and source, title and
  description, existing keywords, and the organism(s), tissue(s), disease(s) and
  instrument(s), plus the sample and data protocols where available. It does not see
  raw spectra or identification results; it summarizes the descriptive metadata.
- **Robustness.** The job parses the model's JSON with a bounded retry (a stricter
  "JSON only" reprompt if the first output isn't parseable), and if the model is
  unavailable or keeps failing it falls back to a no-model summary built from the
  source description/title and keywords. So enrichment always produces a document,
  with or without the model.

Because summaries are produced offline and stored as immutable artifacts, they add
**zero** latency to search — the request path just serves precomputed text.
