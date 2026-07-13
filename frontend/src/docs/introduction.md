# Introduction

The **quantms data portal** is an open, static-first data portal for quantitative
proteomics. It indexes and serves proteomics results produced by the quantms
ecosystem and layers biological search and analytics on top — so you can go from
"which datasets contain this peptide?" to a residue-level view of a protein in a
few clicks.

Everything the portal serves is derived from **standardized, reproducible
reanalyses**: raw public proteomics data reprocessed with the quantms workflow
into a consistent quantitative format, then indexed for search. Because every
dataset is processed the same way, results are directly comparable across studies,
organisms, tissues and instruments.

## What you can do here

- **Search peptides and proteins** across every indexed dataset — find where a
  sequence has been observed, inspect protein sequence coverage and intensity, and
  explore post-translational modifications.
- **Search and browse datasets** and the curated collections that group them.
- **Read corpus-level statistics** — proteome coverage, species, tissues,
  instruments and modification distributions across the whole portal.
- **Download** standardized results for your own analysis, through the browse
  interface or the portal command-line tool.
- **Query the same data as an AI agent** — every user-facing app is also exposed
  to AI assistants through the Model Context Protocol (MCP).

## Who it is for

- **Biologists** asking targeted questions — "is my peptide proteotypic?", "where
  is this protein modified?", "which studies measured this in liver?".
- **Bioinformaticians and data scientists** who want harmonized, machine-readable
  proteomics results as a foundation for downstream analysis.
- **AI agents and tool builders** that need programmatic, structured access to a
  large, consistently processed proteomics corpus.

## The quantms ecosystem

The portal is one piece of a larger open-source stack. Each component has a
focused job, and the portal ties their outputs together:

- **[quantms workflow](https://github.com/bigbio/quantms)** — a reproducible
  Nextflow pipeline for mass-spectrometry-based proteomics that turns raw data into
  quantified peptides and proteins. It produces the results the portal indexes.
- **[quantms.io](https://github.com/bigbio/quantms.io)** — the standardized data
  representation (QPX) for quantms results, so every dataset shares one schema. See
  the [QPX documentation](https://qpx.quantms.org).
- **[pmultiqc](https://github.com/bigbio/pmultiqc)** — quality-control reporting
  for quantms runs, summarizing the health of each reanalysis.
- **[quantms data portal](https://github.com/bigbio/quantms-portal)** — this
  portal: the index, the search and analytics apps, the web interface, and the
  MCP endpoints for AI agents.

Learn more about the broader project at
[quantms.org](https://quantms.org). The next page,
[Infrastructure](/docs/infrastructure), explains the conceptual architecture that
makes the portal fast, cheap to run, and safe to scale.
