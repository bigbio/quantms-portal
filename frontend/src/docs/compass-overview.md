# Proteome Compass — Overview

Proteome Compass places **quantms's own mass-spec evidence** for a protein next to
three orthogonal resources — **PeptideAtlas**, **UniProt protein-existence (PE)**, and
the **Human Protein Atlas (HPA)** — on one record, for every protein in every corpus
organism. It makes the **gaps** first-class, queryable objects: where quantms is behind
(a protein PeptideAtlas sees but quantms doesn't), where it's ahead (quantms-unique), and
where an MS-confirmed protein could upgrade its UniProt PE level.

## The four views

Compass has four modes, and every one is **deep-linkable** — the view, organism, protein,
and preset are reflected in the URL so any state can be shared or bookmarked:

- **Protein passport** (`?mode=protein&acc=P04637`) — the full cross-resource record for
  one protein: quantms evidence (best GPP, unique peptides, datasets, USIs), PeptideAtlas
  presence, UniProt PE, HPA localization/RNA, the reconciled evidence tier, an HPP-compliance
  flag, and the **typed discordances** between resources (see below).
- **Proteomes scoreboard** (`?mode=proteomes`) — a sortable cross-species table: for each
  of the corpus organisms, its proteome size, quantms and PeptideAtlas coverage, GPP-passing
  count, tier mix, and reanalysis headroom. See [Proteomes scoreboard](/docs/compass-scoreboard).
- **Gap Finder** (`?mode=gaps&organism=homo-sapiens`) — per-organism coverage plus the
  actionable gap lists: unobserved reviewed proteins, reanalysis targets, and PE-upgrade
  candidates. See [Gap Finder](/docs/compass-gaps).
- **Explorer** (`?mode=explore&preset=dark`) — a faceted set-query tool over every protein,
  with named presets and taxonomy scoping. See [Explorer & taxonomy](/docs/compass-explorer).

## What it answers

- **How much of each proteome do we cover?** — the share of the UniProt reference proteome
  observed by quantms vs PeptideAtlas, reported on **two denominators**: the reviewed
  **Swiss-Prot** canonical set and the **full** proteome (Swiss-Prot + TrEMBL). Both are
  shown because they answer different questions — see [Evidence tiers & denominators](/docs/compass-tiers).
- **What should we reanalyze next?** — for any organism, the reviewed proteins quantms has
  not yet detected (the reanalysis headroom, itemized and PE-ranked), plus, where a
  PeptideAtlas build exists, the proteins PeptideAtlas observes that quantms does not.
- **Which proteins are PE-upgrade candidates?** — MS-confirmed proteins whose UniProt PE is
  below 1, framed by HPP 3.0 rigor.

## How it's built

Static-first, like the rest of the portal: per-release batch jobs fetch and pin each
source (UniProt, PeptideAtlas builds, HPA, NCBI taxonomy), join them onto the UniProt
identity spine, reconcile each protein into an **evidence tier (T1–T6)** with gap flags
and typed discordances, and publish immutable, content-versioned Parquet artifacts. A
stateless pod pool queries them directly over S3 (DuckDB-over-S3) and serves REST + MCP —
no database to run, and each release is reproducible from its pinned inputs.

## A note on honesty

quantms and PeptideAtlas are *both* mass spectrometry, so their agreement is labeled
**"MS-concordant, not independent"** — UniProt-PE and HPA are kept as the orthogonal
(non-MS) axis. Coverage in sparse (single-dataset) organisms is reported with the number
of contributing datasets always visible, never dressed up as more than it is. The
PeptideAtlas axis is currently human-centric: organisms without a PeptideAtlas build show
that explicitly rather than reporting a misleading 0%.
