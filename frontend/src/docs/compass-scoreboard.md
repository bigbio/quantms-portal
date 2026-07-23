# Proteomes scoreboard

The scoreboard (`?mode=proteomes`) is the cross-species view: one sortable row per corpus
organism, so you can compare proteome completeness across the whole collection at a glance
and drill into any organism's Gap Finder with a click.

## Columns

| Column | Meaning |
|---|---|
| **Organism** | Common name + species, with kingdom |
| **Proteins (SP / full)** | Swiss-Prot reviewed count / full proteome count — the two [denominators](/docs/compass-tiers) |
| **quantms %** | Share of Swiss-Prot observed by quantms (passing GPP); the full-proteome % is shown beneath |
| **PeptideAtlas %** | Share of Swiss-Prot observed by PeptideAtlas — or "no build" where PeptideAtlas has none |
| **GPP-passing** | Number of proteins with at least one peptide passing the GPP gate |
| **Tier mix** | A T1–T6 mini-bar showing the [evidence-tier](/docs/compass-tiers) distribution |
| **Headroom** | Reviewed proteins quantms has **not** yet detected (`n_swissprot − quantms∩Swiss-Prot`) — the reanalysis opportunity |

The table is sortable on any numeric column (default: most headroom first) and filterable by
name/kingdom. Sorting by **Headroom** surfaces the organisms where a reanalysis push would
add the most reviewed-proteome coverage; sorting by **quantms %** shows where the corpus is
already strong.

## Reading it honestly

- **PeptideAtlas is human-centric.** Most non-human organisms show "no build" / 0% for the
  PeptideAtlas column — that is the absence of a PeptideAtlas build, not evidence that those
  proteins are unobserved by the community.
- **Coverage scales with corpus depth.** An organism represented by a single dataset will
  show low coverage; the scoreboard is a map of where the corpus is thin, not a judgement of
  the organism.
- Clicking a row opens that organism in the **Gap Finder**, where the headroom number becomes
  an itemized, PE-ranked list of the specific proteins to target.

## Where the numbers come from

The scoreboard reads the per-organism `gap_summary` block from the release manifest (no
per-request Parquet scan) via the `GET /organisms` endpoint, which reshapes the manifest and
adds the curated common-name + kingdom for each organism. Because it is manifest-backed, the
scoreboard is fast regardless of proteome size.
