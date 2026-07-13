# Data

The portal holds **quantitative proteomics results** produced by reprocessing
public mass-spectrometry studies with the quantms workflow. Because every dataset
is processed the same way and stored in one standardized schema, the whole corpus
is directly comparable.

## What the portal indexes

For each dataset, the portal serves a compact, search-optimized view of the
results, including:

- **Peptides** — the identified peptide sequences.
- **Peptidoforms** — peptides together with their specific modifications, so the
  same sequence carrying different modifications is distinguishable.
- **Proteins and protein groups** — the proteins those peptides map to.
- **Modifications** — post-translational and chemical modifications, resolved to
  the residue and classified as biologically interesting versus
  artifact/label/fixed.
- **Observation signal** — how frequently and how intensely each peptide was
  observed, which powers the coverage and intensity maps.

Each indexed row also carries **per-dataset metadata** — organism, tissue/organism
part, disease, instrument, and links back to the source study — so results can be
filtered and faceted biologically.

## Gene-centric protein identity

Across many studies, the *same* protein is written many ways — a UniProt accession
in one dataset, a mnemonic or a gene name in another. Counting those naively would
double-count proteins. The portal resolves protein identifiers to their **gene**,
the standardized biological unit, so an accession, its mnemonic and its gene name
all refer to one protein and return consistent dataset counts and coverage. Where a
gene mapping is unavailable, the portal degrades gracefully to accession-level
identity.

## Content-addressed dataset identity

A dataset in the portal is identified by **its content**, not by where it came from
or which run produced it. Conceptually: the portal derives a dataset's identity
from the actual data it contains, so **byte-identical results map to the same
canonical entry** regardless of how or where they were generated.

Two practical consequences:

- **One canonical entry per unique dataset.** The same underlying results do not
  appear twice under different names.
- **Provenance is recorded separately.** How a dataset was produced — the workflow
  and source study — is kept as provenance metadata attached to the entry, rather
  than being what defines the entry's identity.

This is a *conceptual* model of identity; you never need to compute or handle any
identifier yourself. The portal presents each dataset with a stable page you can
link to and cite.

## How the data is organized

- Datasets are grouped into curated **[collections](/docs/collections)**.
- Each dataset has a detail page with its metadata and links to the underlying
  files (see [Download data](/docs/download)).
- Corpus-wide summaries are on the [Statistics](/statistics) page.

To explore the data directly, start from
[Dataset Search](/apps/dataset-search) or
[Peptide & Protein Search](/apps/peptide-search).
