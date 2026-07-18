# Proteome Compass — Implementation Plan

*Phased, TDD implementation plan for the **quantms Proteome Compass** app
(`/compass`; gap dashboards = "Gap Finder"). The approved design is the source of
truth: [`protein-evidence-profiler-design.md`](./protein-evidence-profiler-design.md).
This plan tells an engineer exactly what to build, in what order, following the
existing portal-app patterns. It is a plan, not code.*

---

## Goal

Ship a new quantms-portal app that, for every protein in every corpus organism,
places quantms's own MS evidence next to **PeptideAtlas, UniProt (PE), and HPA** on
one record, and makes the **gaps** (proteins/tissues/PE-levels where quantms is behind
or ahead) first-class, queryable objects. It must fit the established static-first
stack with **no new database tier**:

> per-release **batch jobs** → immutable **S3 Parquet/JSON artifacts** → stateless
> **DuckDB-over-S3 FastAPI + MCP** pods → **Vue** view. Everything degrades gracefully;
> every external source version is pinned in a ref-manifest.

**v1 definition of done:** an all-52-organism `protein_profile.parquet` + per-organism
`gap_summary.json` are live, the richest human 4-source join drives the protein page +
Gap Finder dashboards + the faceted set-query explorer + the PA-vs-quantms comparison +
the taxonomy tree, and all of it is reachable via REST, MCP, and the Vue view. neXtProt/HPP
overlay is explicitly deferred to v2 without reshaping anything.

---

## Architecture summary

New backend package `apps/proteome_compass/` — a sibling of `apps/peptide_search/`
and `apps/protein_metadata/`. It **reuses** the protein_metadata ingest primitives
(UniProt proteome fetch, taxon resolution, HPA parse) and the shared infra
(`apps/duckdb_s3.py`, `apps/mcp_util.py`, `config.py`, `storage.py`,
`peptide_search/release.py` manifest pattern). It **adds** three external feeds
(PeptideAtlas build, an extended HPA profile, an NCBI taxonomy tree) plus one join job.

**Batch tier (jobs → S3 artifacts):**

1. Per-source **ingest** jobs fetch + pin each reference (UniProt ref-proteome+PE,
   PeptideAtlas per-build tables, HPA RNA/IHC/subcellular, NCBI taxdump) into
   normalized per-organism staging Parquet + a `ref_manifest.json`.
2. A single **`profile-builder`** job joins the 4 sources + quantms internal
   (peptide-search index / GPP / pGPP / coverage / observed tissues) onto the
   UniProt spine, computes the reconciled evidence tier + gap flags + USIs +
   HPP-compliance flag, and emits per-`(organism, release)` artifacts + corpus
   aggregates + a serving **release manifest** (atomic pointer flip, like
   peptide-search).

**Artifact layout** (under the `quantms/apps/proteome-compass/` prefix; `{organism}`
is a filesystem-safe slug of the resolved scientific name, `{release}` is the
content-version id):

```
quantms/apps/proteome-compass/
  staging/{source}/{organism}/{release}/...          # per-source normalized inputs
  profiles/{organism}/{release}/
      protein_profile.parquet                         # one row per (uniprot_acc, organism, release)
      gap_summary.json                                # corpus metrics for this organism
      tissue_gap_matrix.parquet                       # HPA-expressed vs quantms-observed per tissue
      reanalysis_targets.parquet                      # T4 ranked
      pe_upgrade_candidates.parquet                   # T2 HPP-framed
      ref_manifest.json                               # pinned source versions + licenses
  taxonomy_tree.json                                  # clade hierarchy over all corpus organisms
  db/manifest.json                                    # serving release pointer (all organisms + releases)
```

**Serving tier:** a stateless `proteome-compass` FastAPI app (Deployment of ≥2 pods)
opens the release manifest's Parquet set **directly over S3 via DuckDB httpfs** (the
peptide-search "serving-from-shards" model — profiles are small enough to query
in-place; no prebuilt-db download needed), serves REST + `/mcp`, and reloads on a
manifest version bump via a 120s poller. Routed by Caddy at `api.quantms.org/compass/*`.

**Frontend:** one lazy-loaded Vue view `ProteomeCompass.vue` at `/apps/compass` plus
supporting components (4-column protein card, faceted explorer with URL sync, PA-vs-quantms
comparison, Gap Finder dashboards, collapsible taxonomy tree), a `COMPASS_BASE` in
`config.js`, and a new by-app docs group.

---

## Global constraints (apply to every task)

- **TDD, always.** For each task: write the failing test first, run it and see it fail
  for the right reason, implement the minimum to pass, run the full file's tests, then
  commit. Tests live in `quantms-portal-backend/tests/test_compass_*.py` (backend) and
  are added to the existing suite. Backend runs under `pytest`; the suite already has
  `tests/fakes.py` and `tests/mcp_client.py` to reuse.
- **Never hit the network in tests.** Every external transport goes behind a small
  factory (`_build_http_client`, `UniProtIdMappingClient`-style) so tests inject a fake,
  exactly as `enrich.py` / `hpa.py` / `proteome.py` already do.
- **Best-effort ingest, fail-loud publish.** A missing/absent optional source degrades
  to null columns and a `warnings[]` entry, never a crash (design §8 graceful
  degradation). But a *configured* source that loads EMPTY must **refuse to overwrite**
  the prior good artifact and exit non-zero (the `hpa.run` refuse-empty guard; the
  `enrich` refuse-empty guard). Pin+display the reference-proteome id on every % (design
  "denominator drift").
- **Nullable sources, one keyed row.** The profile is keyed `(uniprot_acc, organism,
  release)` with nullable PA/HPA/neXtProt columns. The builder loops all 52 organisms;
  each renders whatever sources exist. `union_by_name=true` on every `read_parquet`
  glob (heterogeneous per-organism schemas — the enrich.py lesson).
- **Identity spine = UniProt.** UniProt accession is the canonical key; keep secondary
  accessions; HPA fields are **gene-scoped** (join on `(taxon, gene)`, never gene alone —
  the protein_metadata convention); record match-method + unmapped-rate as QC.
- **Immutable + idempotent.** Content-addressed release ids (reuse the
  `release.content_version` hashing idea); re-running identical inputs is a no-op;
  publishing is an atomic pointer flip of `db/manifest.json`.
- **MS-vs-MS honesty.** Label PA↔quantms agreement "MS-concordant, not independent";
  keep HPA/UniProt/(neXtProt) as the orthogonal axis; store PA↔quantms dataset overlap.
- **Config additions** go in `config.py` `PathConfig` as `render_compass_*` helpers +
  reader key constants in a new `apps/proteome_compass/reader.py` (mirroring
  `protein_metadata/reader.py`), never hardcoded strings scattered across modules.
- **Every job is a `[project.scripts]` console entry** in `pyproject.toml` and a
  `deploy/*.yaml` git-clone+pip-install Job/Deployment (the established pod shape).

---

## Reuse map (what is reused vs newly written)

| Capability | Reuse (import / mirror) | New |
| --- | --- | --- |
| Organism name → NCBI taxon | `protein_metadata/proteome.py::resolve_taxon_by_name` | resolution loop + `organism_resolution.json` + unresolved QC |
| UniProt reference proteome + UPID | `proteome.py::reference_proteome_upid`, `fetch_proteome`, `parse_fasta` | per-organism **PE + xref + secondary-acc** extraction to Parquet |
| Distinct accessions / coverage / gene map | `protein_metadata/enrich.py`, `reader.py` | consume its published `index.json` as quantms-side input |
| HPA RNA tissue map | `protein_metadata/hpa.py::parse_rna_consensus` | extend for `normal_tissue.tsv` (IHC) + `subcellular_location.tsv` |
| DuckDB S3 secret | `apps/duckdb_s3.py::configure_duckdb_s3_secret` | — |
| MCP mount | `apps/mcp_util.py::mount_mcp` | the 5 compass tools |
| Release manifest / atomic flip / content-version | `peptide_search/release.py` | compass manifest over profile artifacts |
| Serving-from-S3 + manifest poller | `peptide_search/api.py` + `search.py` open path | compass reader + routes |
| Storage / settings | `storage.py`, `config.py` | `render_compass_*` path helpers |
| PeptideAtlas feed | — | **all new** (`peptideatlas.py`) |
| NCBI taxonomy tree | — | **all new** (`taxonomy.py`) |
| profile join + tiering + gaps | — | **all new** (`build_profile.py`, `reconcile.py`, `gaps.py`) |

---

# PHASE 0 — Scaffolding (½ day)

**Goal:** the package, config keys, reader constants, and empty entry points exist so
every later task lands in a real home. No behavior yet.

### Task 0.1 — Package skeleton + reader constants + PathConfig helpers

**Create:**
- `src/quantms_portal_backend/apps/proteome_compass/__init__.py`
- `src/quantms_portal_backend/apps/proteome_compass/reader.py` — key + env constants
  (mirror `protein_metadata/reader.py`):
  `COMPASS_PREFIX = "quantms/apps/proteome-compass"`,
  `COMPASS_MANIFEST_KEY = ".../db/manifest.json"`,
  `TAXONOMY_TREE_KEY = ".../taxonomy_tree.json"`,
  `COMPASS_MANIFEST_ENV`, plus `load_taxonomy_tree(source)` and
  `load_ref_manifest(source)` loaders (copy the retry/refuse-empty semantics of
  `protein_metadata/reader.py::_http_get_json`).

**Modify:**
- `src/quantms_portal_backend/config.py` — add `PathConfig.render_compass_prefix()`,
  `render_compass_profile_prefix(organism, release)`,
  `render_compass_staging_prefix(source, organism, release)`,
  `render_compass_manifest_key()`, `render_compass_taxonomy_key()`.

**Interface produced:** stable S3 key layout + reader constants every later task imports.

**TDD:** `tests/test_compass_paths.py` — assert each `render_compass_*` returns the
normalized key strings above (uses `_normalize_key`, no dup slashes). Run → fail (no
methods) → implement → pass → **commit** `compass: package skeleton + path helpers`.

### Task 0.2 — Entry-point stubs

**Modify:** `pyproject.toml` `[project.scripts]` — reserve the console names now (each
points at a `main` that will exist by the end of its phase):
`quantms-portal-compass-resolve`, `quantms-portal-compass-uniprot`,
`quantms-portal-compass-peptideatlas`, `quantms-portal-compass-hpa`,
`quantms-portal-compass-taxonomy`, `quantms-portal-compass-build`,
`quantms-portal-app-compass`.

**TDD:** `tests/test_compass_entrypoints.py` — import each target module path and assert
a `main`/`run` attribute exists (add them as `def main(): raise NotImplementedError`
stubs to unblock, filled per phase). Commit `compass: reserve entry points`.

---

# PHASE 1 — Ingest (per-source fetch + pin) (3–4 days)

**Goal:** each external source lands as a normalized, pinned per-organism staging
artifact, plus organism resolution and the taxonomy tree. Human resolves cleanly; the
microbiome long tail is normalized; unresolved names are a QC metric, not a crash.

### Task 1.1 — Organism → NCBI taxon → UniProt proteome resolution

**Create:** `apps/proteome_compass/resolve.py`.

**Interface produced** (`organism_resolution.json` staging artifact + a `run` job):
```python
def resolve_corpus_organisms(
    organism_names: list[str], *, http, overrides: dict[str, int] | None = None
) -> tuple[dict[str, dict], dict]:
    # returns ({raw_name: {"taxon": int|None, "scientific_name": str|None,
    #                      "upid": str|None, "method": "override|species|unconstrained|unresolved"}},
    #          qc={"total": N, "resolved": N, "unresolved": [names], "unresolved_pct": f})
```
- **Reuse:** `proteome.resolve_taxon_by_name` (species-rank-first) and
  `proteome.reference_proteome_upid`. Consult the existing
  `protein_metadata/reader.py::ORGANISM_OVERRIDES_KEY` map **before** auto-resolution
  (design "human/mouse resolve cleanly; the long tail needs normalization"; the msnet
  organism-override precedent).
- **Input** = distinct corpus organism names. Source them from the quantms side:
  either the published `protein-metadata/index.json` (`organism`/`taxon` per accession)
  or the peptide-search stats organism facet. Prefer the already-resolved taxon there
  when present; only run name-resolution for the noisy remainder.
- Emit `staging/resolution/{release}/organism_resolution.json` + the QC block to stdout
  (the `run` job pattern from `hpa.py::run`).

**Risk flag (in the module docstring):** noisy SDRF names ("akkermansia muciniphilia",
"mycoplasmen", "drosophila" vs "drosophila melanogaster"). Mitigation: overrides map +
OLS/taxonomy harmonizer as a follow-up; per-release `unresolved_pct` QC metric that
gates nothing but is surfaced in the ref-manifest.

**TDD:** `tests/test_compass_resolve.py` with a fake http returning canned taxonomy JSON:
(a) clean human name → 9606 + upid; (b) misspelled name → `unresolved`, appears in QC;
(c) override wins over auto-resolution; (d) already-resolved taxon skips the network.
Fail → implement → pass → **commit**.

### Task 1.2 — UniProt reference proteome + PE ingest (per organism)

**Create:** `apps/proteome_compass/uniprot_ref.py`.

**Interface produced** — per-organism `staging/uniprot/{organism}/{release}/uniprot.parquet`
with columns: `uniprot_acc` (PK), `secondary_accs[]`, `gene`, `taxon`, `organism`,
`seq_len`, `uniprot_pe` (1–5), `ensembl_gene`, `ensembl_prot`, `hgnc`, `geneid`,
`is_canonical`, `reference_proteome_upid`.
```python
def fetch_uniprot_proteome_rows(taxon: int, upid: str | None, *, http) -> list[dict]
def write_uniprot_parquet(rows: list[dict], out_path: str) -> int
```
- **Reuse:** `proteome.fetch_proteome` (reviewed-first, reference-fallback), `parse_fasta`,
  the cursor-pagination + complete-or-nothing fetch (`_fetch_fasta`). **Extend** the fetch
  to the `/uniprotkb/search` endpoint with `fields=accession,gene_names,protein_existence,
  sequence,xref_ensembl,xref_hgnc,xref_geneid,sequence_version&format=tsv` so PE + xrefs +
  secondary accs come back (the FASTA path in `proteome.py` only yields sequences; PE needs
  the TSV/JSON field path — mirror `enrich.py`'s UniProt field extraction).
- This is the **denominator + identity spine for all 52 organisms** (design scope table).
  It must never silently truncate (the "complete-or-nothing" guard already in `_fetch_fasta`)
  — a partial proteome corrupts every coverage %.
- Persist `reference_proteome_upid` on every row so the served % can display the pinned
  denominator (design "denominator drift").

**TDD:** `tests/test_compass_uniprot_ref.py` — fake http returns a canned TSV page (2
proteins, PE1 + PE2, one with an Ensembl xref, one with a secondary acc + `rel="next"`
pagination); assert the parsed rows, PE ints, xref split, secondary-acc capture, and that
a mid-page fetch failure yields `[]` (complete-or-nothing), not a partial. Commit.

### Task 1.3 — PeptideAtlas build ingest (NEW)

**Create:** `apps/proteome_compass/peptideatlas.py`.

**Interface produced** — per-organism `staging/peptideatlas/{organism}/{release}/pa.parquet`
(only for organisms with a PA build) with columns: `uniprot_acc`, `pa_presence_level`
(canonical / possibly-distinguished / subsumed / …), `pa_observed` (bool), `pa_n_samples`,
`pa_n_observations`, `pa_n_tissues`, `pa_observed_tissues[]`, `pa_build_name`, `pa_build_date`.
```python
PA_BUILDS: dict[int, dict]   # taxon -> {"build_name", "protlist_url", "sample_tables_url", "release"}
def fetch_pa_build(taxon: int, build: dict, *, http) -> list[dict]
def parse_paprotlist(text: str) -> list[dict]          # presence level per protein
def parse_pa_sample_tables(text: str) -> dict          # per-protein sample/tissue counts
def map_pa_ids_to_uniprot(rows, prot_map) -> list[dict]  # via prot_map, keep the UniProt spine
```
- **All new.** Download `PAprotlist`, `prot_map`, and the per-sample/per-tissue tables from
  `peptideatlas.org/builds` for each build in a **pinned `PA_BUILDS` registry** (design:
  human ~annual, mouse, and the ~5–8 model organisms in the corpus — *A. thaliana*,
  *D. melanogaster*, *D. rerio*, *E. coli*, yeast). The registry pins **build name + date +
  URL** per taxon (design "pin build name/date").
- Map PA protein identifiers to the **UniProt accession** via `prot_map` so PA joins on the
  spine (design identity-mapping risk: PA IDs ↔ UniProt not 1:1). Record match method +
  unmapped rate.
- Organisms with **no build** simply produce **no** PA staging file → the builder left-joins
  null PA columns (graceful degradation). PA freshness is bounded by PA cadence — surfaced,
  not fatal.
- Store PA license/terms per build in the row-set metadata for the ref-manifest.

**Risk flags (docstring):** PA build cadence/scope (human-dominant, irregular); PA IDs↔UniProt
mapping; PA is *also MS* → not an independent axis (design §8). Tissue names are PA's own
vocabulary — reconciled to UBERON/BTO in Task 1.4/2.3, not here.

**TDD:** `tests/test_compass_peptideatlas.py` — canned `PAprotlist` + `prot_map` + a small
sample table; assert presence-level parse, per-protein sample/tissue counts, UniProt mapping
via prot_map, and that an organism absent from `PA_BUILDS` yields `[]` (no file). Commit.

### Task 1.4 — HPA profile ingest (extend reuse)

**Create:** `apps/proteome_compass/hpa_profile.py`.

**Interface produced** — `staging/hpa/homo-sapiens/{release}/hpa.parquet` keyed by
`(taxon, gene)`: `rna_tissues` (map tissue→nTPM), `protein_tissues` (IHC level +
reliability per tissue), `subcellular[]`, `hpa_reliability`, `hpa_version`.
```python
def parse_normal_tissue(rows_or_path) -> dict     # {gene: {tissue: {level, reliability}}}
def parse_subcellular(rows_or_path) -> dict        # {gene: [locations]}
def build_hpa_profile(rna_map, normal_tissue, subcellular, version) -> list[dict]
```
- **Reuse:** `protein_metadata/hpa.py::parse_rna_consensus` + `download_consensus`
  (single-member-zip streaming) verbatim for the RNA table. **Add** parsers for
  `normal_tissue.tsv` (IHC + reliability) and `subcellular_location.tsv`.
- **Human-only (some mouse).** Gene-scoped; the builder joins on `(taxon, gene)`.
- Capture the HPA **version + license** (design: CC BY 4.0 now, **CC BY-SA 3.0 for v21 &
  earlier — check the pin**) into the row metadata for the ref-manifest.
- All tissue names normalized to UBERON/BTO via OLS is a **Task 2.3** concern (the
  `protein_metadata/tissue_map.py` tooling already exists) — here we keep HPA's own names +
  emit the raw vocab so the reconciliation step maps them.

**TDD:** `tests/test_compass_hpa_profile.py` — canned RNA + normal_tissue + subcellular rows;
assert per-gene nTPM (reuses the floor-drop behavior), IHC level+reliability capture,
subcellular list, and that the version/license is recorded. Commit.

### Task 1.5 — NCBI taxonomy tree (NEW)

**Create:** `apps/proteome_compass/taxonomy.py`.

**Interface produced** — `taxonomy_tree.json`: a clade hierarchy (superkingdom → … →
species) over the corpus organisms, each node `{taxon, name, rank, children[],
n_organisms, n_proteins, coverage_pct}` (counts filled by the builder in Phase 2; the
tree *shape* is built here from the NCBI taxdump lineage of the resolved taxa).
```python
def build_taxonomy_tree(resolved_taxa: list[int], taxdump) -> dict
def lineage(taxon: int, taxdump) -> list[dict]     # root→leaf ranked lineage
```
- **All new.** Fetch the NCBI `taxdump` (`nodes.dmp`/`names.dmp`) or use the per-taxon
  UniProt taxonomy lineage endpoint (already reachable — `proteome.py` hits
  `rest.uniprot.org/taxonomy`); prefer taxdump for a single bulk download pinned in the
  ref-manifest. Build the minimal spanning tree over the corpus taxa (design "clade
  hierarchy over the corpus organisms").
- Node protein/coverage counts are **placeholders here**, populated by the builder join
  (Phase 2, Task 2.5) so the tree reflects the actual profile. This future-proofs the
  bacteria/virus/plant/animal spread as species are added.

**TDD:** `tests/test_compass_taxonomy.py` — a tiny fake taxdump (human, mouse, E. coli,
a bacterium) → assert the tree nests species under the right clades (Mammalia, Bacteria),
`n_organisms` per node, and that an unresolved taxon is dropped (not crashed). Commit.

### Task 1.6 — ref-manifest (pin versions + licenses)

**Create:** `apps/proteome_compass/ref_manifest.py`.

**Interface produced** — `profiles/{organism}/{release}/ref_manifest.json`:
```python
def build_ref_manifest(sources: dict) -> dict
# {"release": id, "generated_at": iso,
#  "sources": {"uniprot": {"release":..., "upid":..., "license":"CC BY 4.0"},
#              "peptideatlas": {"build_name":..., "build_date":..., "license":...},
#              "hpa": {"version":"v25.1", "license":"CC BY 4.0"},
#              "quantms": {"index_manifest_version":...},
#              "ncbi_taxdump": {"date":...}},
#  "organism_resolution_qc": {"unresolved_pct":...}}
```
- Records the pinned version + license **per source** (design §8: "store license per
  source"). Reused by the builder and surfaced in the API + UI wherever a coverage %
  or evidence claim appears.

**TDD:** `tests/test_compass_ref_manifest.py` — assert the manifest captures each source's
pinned id + license and the resolution QC; missing optional source → the source key is
present with `null` version (not omitted). Commit.

**Phase 1 deploy stubs (wired fully in Phase 5):** each of 1.1–1.5 gets a `main()` +
console entry so it is runnable as a Job.

---

# PHASE 2 — profile-builder job (4–5 days)

**Goal:** join the 4 sources + quantms internal onto the UniProt spine → one keyed row per
protein with a reconciled tier, gap flags, USIs, and HPP-compliance flag; emit the corpus
aggregates; loop all 52 organisms; publish via an atomic manifest flip. **Human is built
first (richest), but the loop covers all 52 in the same v1** (design "first build slice").

### Task 2.1 — Profile join (spine + 4 sources + quantms)

**Create:** `apps/proteome_compass/build_profile.py` (join logic) + `schema.py` (column
constants + the profile Arrow schema).

**Interface produced** — `profiles/{organism}/{release}/protein_profile.parquet`, one row
per `(uniprot_acc, organism, release)`, columns exactly per design §3:
identity (`uniprot_acc`, `secondary_accs`, `gene`, `ensembl_*`, `taxon`, `seq_len`),
existence (`uniprot_pe`, `nextprot_pe`=null-in-v1, `hpp_status`=null-in-v1),
`ms_evidence_quantms` (`quantms_observed`, `pgpp`, `best_peptide_gpp`, `n_unique_peptides`,
`n_datasets`, `coverage_pct`, `observed_tissues[]`, `usis[]`),
`ms_evidence_peptideatlas` (`pa_presence_level`, `pa_observed`, `pa_n_samples`,
`pa_n_observations`, `pa_n_tissues`, `pa_observed_tissues[]`),
`tissue_evidence_hpa` (`rna_tissues`, `protein_tissues`, `subcellular`, `hpa_reliability`),
`reconciled` (`evidence_tier`, `gap_flags[]`, `agreement_summary`, `hpp_compliant`),
`provenance` (`ref_manifest_id`).
```python
def build_profile_for_organism(
    organism: str, taxon: int, release: str, *,
    uniprot_pq: str, pa_pq: str | None, hpa_pq: str | None,
    quantms_index: str, quantms_meta: str, con
) -> str:   # writes protein_profile.parquet, returns path
```
- **Spine LEFT JOIN.** Start from the UniProt Parquet (all accessions = the denominator);
  LEFT JOIN quantms (on `uniprot_acc`), PA (on mapped `uniprot_acc`), HPA (on `(taxon,
  gene)`). Nullable everywhere — a single-dataset bacterium gets UniProt+quantms only.
- **quantms internal** = read the peptide-search index Parquet glob + its published
  artifacts (the `protein-metadata/index.json` gives `coverage_pct`/`n_peptides`; the
  peptide-search `gpp.parquet` gives GPP; pGPP + `observed_tissues` come from the index /
  SDRF-derived facets). **Reuse** `configure_duckdb_s3_secret` + `union_by_name=true`.
  This is a **local artifact read, not a download** (design §2).
- **USIs** (design strategic reframing): per observed protein, carry a small list of
  representative Universal Spectrum Identifiers for its best peptides (from the index rows)
  so quantms evidence is HPP-submittable.
- **Sparsity honesty** (design): for single-dataset organisms the GPP reproducibility
  signal is weak by construction. Compute `quantms_observed` from **per-dataset class-1 FDR
  + pGPP non-reproducibility features**, NOT cross-study re-detection; always carry
  `n_datasets` so a single-study call is transparent. Do **not** down-label a sparse GPP as
  "low quality."

**TDD:** `tests/test_compass_build_profile.py` — build tiny in-memory DuckDB tables for
UniProt (3 accs), quantms (2 observed), PA (1 observed), HPA (1 gene); assert: 3 output
rows (spine preserved), correct null-fill for the PA/HPA-absent accs, USIs present on
observed rows, `n_datasets` carried, and an organism with no PA/HPA input still yields
UniProt+quantms rows. Commit.

### Task 2.2 — Reconciliation: evidence tier + gap flags

**Create:** `apps/proteome_compass/reconcile.py` (mirror the name of
`peptide_search/reconcile.py`; separate module).

**Interface produced:**
```python
def evidence_tier(row: dict) -> str          # "T1".."T6" per design §3
def gap_flags(row: dict) -> list[str]         # e.g. ["reanalysis_target","pe_upgrade_candidate",...]
def agreement_summary(row: dict) -> dict      # {ms_concordant: bool, orthogonal_axis: {...}, disagreements:[...]}
def hpp_compliant(row: dict) -> bool          # >=2 unique >=9-aa peptides, global class-1 FDR, USI present
```
- **Tiers exactly per design §3:** T1 multi-resource confirmed (quantms + PA-canonical +
  PE1); T2 MS-confirmed / PE-upgrade candidate (quantms + PA but PE<1 / HPP-missing); T3
  quantms-unique MS (observed, not PA-canonical); T4 PA-only MS (→ reanalysis target); T5
  transcript/other only; T6 dark. Computed at **build time, stored** (design "stored, not
  query-time").
- **HPP-compliance flag** implements HPP guidelines 3.0 rigor (≥2 unique ≥9-aa peptides,
  global class-1 FDR, USI-referenced) — the design's strategic requirement. Frame T2 as
  *candidates* only.
- **`agreement_summary`** labels PA↔quantms concordance "MS-concordant, not independent"
  and keeps the HPA/UniProt orthogonal axis explicit (design §8 circularity mitigation).

**TDD:** `tests/test_compass_reconcile.py` — parametrized rows hitting each of T1–T6 and each
gap flag; a PA-only row → T4 + `reanalysis_target`; a PE3 row observed by quantms with 2
unique 10-aa peptides + USI → T2 + `hpp_compliant=True`. Commit.

### Task 2.3 — Corpus aggregates + tissue reconciliation

**Create:** `apps/proteome_compass/gaps.py`.

**Interface produced** — the per-organism corpus artifacts (design §4):
```python
def gap_summary(profile_pq: str, ref_manifest: dict, con) -> dict
# {"reference_proteome_upid":..., "n_uniprot":N,
#  "pct_uniprot_covered_quantms":f, "pct_uniprot_covered_pa":f,   # SAME denominator
#  "pct_pa_recovered_by_quantms":f, "pct_quantms_unique":f,
#  "by_pe": {...}, "by_tier": {...}}
def tissue_gap_matrix(profile_pq, tissue_ontology, con) -> "parquet"   # HPA-expressed vs quantms-observed per tissue
def reanalysis_targets(profile_pq, con) -> "parquet"   # T4 ranked by pa_n_samples * tissue breadth, minus already-reanalyzed PXDs
def pe_upgrade_candidates(profile_pq, con) -> "parquet" # T2, strict pGPP + >=2 unique peptides across >=2 datasets, HPP-framed
```
- Every % uses the **same UniProt denominator** and stores the pinned `upid` alongside
  (design "denominator drift" + "pin+display the reference target list on every coverage %").
- **Tissue-vocab reconciliation:** map HPA tissue names + quantms SDRF tissues + PA tissues
  to **UBERON/BTO via OLS** before building the tissue-gap matrix. **Reuse** the existing
  `protein_metadata/tissue_map.py` harmonizer tooling (design §8: "harmonizer tooling
  exists"). Unmapped tissues → a QC count, not dropped silently.
- **reanalysis_targets** filtered to not-yet-reanalyzed PXDs (feeds the reanalysis queue) —
  join against the corpus's known-reanalyzed accession set.

**Risk flag:** tissue-vocab mismatch across three resources is real; the OLS mapping is
best-effort and the unmapped rate is a surfaced QC metric.

**TDD:** `tests/test_compass_gaps.py` — a small profile with known tier/PE distribution;
assert the four coverage %s use one denominator, the tier/PE breakdowns sum correctly,
reanalysis_targets is T4-only and ranked, pe_upgrade_candidates enforces the ≥2-unique/≥2-
datasets/HPP filter, and the tissue matrix maps a canned HPA tissue to its UBERON id via a
fake OLS client. Commit.

### Task 2.4 — Builder orchestration + release manifest + taxonomy counts

**Create:** `apps/proteome_compass/builder.py` (the job `main`).

**Interface produced** — the `quantms-portal-compass-build` job:
- Loops **all 52 corpus organisms** (from `organism_resolution.json`), building each
  organism's profile + aggregates; **human first** (ordering only — richest payoff — but
  all organisms ship in the same run).
- Assembles a **release manifest** (`db/manifest.json`) listing every organism's
  `protein_profile.parquet` + aggregate keys, versioned by content hash. **Reuse the
  `peptide_search/release.py` pattern**: write `db/<version>/manifest.json` (immutable) then
  copy to the stable `db/manifest.json` (atomic pointer flip; rollback = re-point).
- Back-fills `taxonomy_tree.json` node counts (`n_proteins`, `coverage_pct`) from the built
  profiles (Task 1.5 left them as placeholders).
- **Refuse-empty guard:** if the whole build yields zero profile rows (e.g. UniProt fetch
  outage), refuse to flip the manifest and exit non-zero — never clobber a good release
  (the `hpa.run` / `enrich` precedent).
- Per-organism failure is isolated: one organism's source outage degrades that organism (or
  skips it with a warning), never fails the other 51.

**TDD:** `tests/test_compass_builder.py` — a fake corpus of 3 organisms (human w/ 4 sources,
mouse w/ 3, a bacterium w/ 2); assert all 3 profiles built, the manifest lists all 3 +
their aggregates, the version is deterministic (re-run = same id = no-op), taxonomy counts
back-filled, and a zero-row build does NOT flip the manifest. Commit.

---

# PHASE 3 — Query app (stateless DuckDB-over-S3 FastAPI + MCP) (3–4 days)

**Goal:** serve the profiles + gaps + facets + taxonomy over REST and MCP from a stateless
pod pool that opens the manifest's Parquet directly over S3 and reloads on a version bump.

### Task 3.1 — Profile index reader (DuckDB-over-S3 + manifest poller)

**Create:** `apps/proteome_compass/index.py` — `CompassIndex`, mirroring the
`PeptideSearchIndex` open/refresh path but **read-only over the profile Parquet set**
(no heavy materialize — profiles are small; query in place).

**Interface produced:**
```python
class CompassIndex:
    def __init__(self, manifest_ref, *, storage_config=None): ...
    def available(self) -> bool
    def refresh_from_manifest(self) -> bool        # reload on version bump (atomic, off-lock)
    def query(self, filters, *, limit, offset, sort) -> dict
    def profile(self, acc: str, organism: str | None) -> dict
    def facets(self) -> dict
    def gap_summary(self, organism) -> dict
    def reanalysis_targets(self, filters, limit, offset) -> dict
    def pe_upgrade_candidates(self, filters, limit, offset) -> dict
    def tissue_map(self, organism) -> dict
    def taxonomy(self, clade: str | None) -> dict
```
- **Reuse:** `configure_duckdb_s3_secret`, `INSTALL httpfs`, `union_by_name=true`,
  `read_parquet(['s3://…', …])` over the manifest's per-organism profile keys — exactly the
  `peptide_search/search.py` open path (lines ~477–701). Secondary-accession lookups resolve
  to the canonical row (identity spine).
- Manifest poller thread (copy `peptide_search/api.py::_start_manifest_poller`), env
  `COMPASS_MANIFEST_POLL_SECONDS` default 120.
- Every method degrades to an empty-but-well-keyed result when the index is unavailable
  (the `_empty_*` convention in `peptide_search/api.py`).

**TDD:** `tests/test_compass_index.py` — build a tiny local profile Parquet + a manifest
JSON pointing at it; assert `profile()` returns the keyed row (incl. via a secondary acc),
`facets()` lists the dimensions, `query()` filters, and an absent manifest → `available()
False` + empty results. Commit.

### Task 3.2 — Faceted `/query` + `/facets` (the set-queries)

**Create:** `apps/proteome_compass/api.py` (FastAPI app, mirrors
`peptide_search/api.py`).

**Interface produced** — REST:
- `GET /facets` → the facetable dimensions + value lists (design §6.5): seen-by-quantms,
  PA presence level, UniProt PE, HPA RNA/IHC, evidence tier, quantms counts, PA counts,
  tissue, organism/clade.
- `GET /query?...&clade=...` → sortable protein table + live count + the composed facet
  filters. Supports the **named presets as facet states** (design §6.5):
  - `pa_observed AND NOT quantms_observed` → "in PA not quantms" (T4).
  - `quantms_observed AND NOT pa_observed` → "in quantms not PA" (T3).
  - `pa_n_observations > quantms_n_obs` (and the inverse) → over/under-sampled.
  - `uniprot_pe IN (2,3,4,5) AND quantms_observed` → PE-upgrade candidates (T2).
  - `hpa_rna_expressed AND NOT ms_anywhere` → orthogonal-only.
  - Any query **scopable to a clade** via `clade=` (joins the taxonomy subtree taxa).
- `GET /query/export?format=csv|parquet` → the filtered set as a download (design "CSV/parquet
  export").
- Clamp `limit`/`offset` (reuse the `_clamp_limit`/`_clamp_offset`/`_MAX_LIMIT` helpers'
  shape from `peptide_search/api.py`).

**TDD:** `tests/test_compass_query.py` (FastAPI `TestClient`) — seed the index with rows
spanning tiers/PE/PA-counts; assert each preset returns the correct set + count, the
`clade=` scope narrows to subtree taxa, sort + pagination work, and export returns the
right content-type. Commit.

### Task 3.3 — `/profile/{acc}` + `/gaps/*` + `/taxonomy`

**Modify:** `apps/proteome_compass/api.py`.

**Interface produced** — REST (design §5):
- `GET /profile/{acc}?organism=` → the full 4-source record + tier + agreement banner +
  USIs + `hpp_compliant` + deep links to quantms datasets. Resolves secondary accs.
- `GET /gaps/summary?organism=` → `gap_summary.json` (with the pinned `upid` displayed).
- `GET /gaps/reanalysis-targets`, `GET /gaps/pe-upgrades`, `GET /gaps/tissue-map` → the
  ranked/filtered lists.
- `GET /taxonomy?clade=` → the collapsible tree (or a subtree) with per-node counts.
- `GET /health` (200 always, `index_available` flag) + `GET /ready` (200 only when the
  manifest set is open) — the peptide-search readiness contract for the CI health-gate.

**TDD:** `tests/test_compass_endpoints.py` — assert `/profile` returns the keyed record +
`hpp_compliant` + USIs, each `/gaps/*` returns its artifact shape, `/taxonomy?clade=Mammalia`
returns the subtree, `/health` is 200 even with no index, `/ready` reflects availability.
Commit.

### Task 3.4 — MCP tools

**Modify:** `apps/proteome_compass/api.py` — mount MCP via `mount_mcp(app, "proteome-compass",
[...tools], instructions=...)` (reuse `apps/mcp_util.py` verbatim).

**Interface produced** — the 5 tools from design §5/§6.5, each a plain typed+documented
function that also backs a REST route (the mcp_util convention):
`get_protein_profile(acc, organism)`, `list_reanalysis_targets(organism, clade, limit)`,
`list_pe_upgrade_candidates(organism, clade, limit)`, `get_coverage_summary(organism)`,
`find_tissue_gaps(organism)`, plus `browse_taxonomy(clade)` (design §6.5). Enforce the same
`limit` ceiling the REST routes use (MCP must not bypass it — the peptide-search rule).

**TDD:** `tests/test_compass_mcp.py` — use `tests/mcp_client.py` to `tools/list` (assert all
6 present, `readOnlyHint`) and `tools/call get_protein_profile` returns the record; a huge
result is capped like the REST route. Commit.

### Task 3.5 — App entry point + graceful degradation wiring

**Create:** `def run()`/`main()` in `api.py` for `quantms-portal-app-compass`; env
`COMPASS_MANIFEST`, `APP_ROOT_PATH=/compass`, CORS `*`. Confirm the degraded-mode empty
responses share the live key set (the `_empty_search` lesson — a consumer never KeyErrors
when the index is down).

**TDD:** `tests/test_compass_app_contract.py` — with `COMPASS_MANIFEST` unset, every route
returns 200 with the documented empty shape; `/mcp` still initializes. Commit.

---

# PHASE 4 — Frontend (Vue view + docs) (3–4 days)

**Goal:** the protein page, the faceted explorer (URL-synced, presets, export), the
PA-vs-quantms comparison, the Gap Finder dashboards, the taxonomy tree, and docs.

### Task 4.1 — Config base + API client + route + nav

**Modify:**
- `frontend/src/config.js` — add `export const COMPASS_BASE = \`${API_BASE}/compass\``.
- `frontend/src/router.js` — add `{ path: '/apps/compass', component: () =>
  import('./views/ProteomeCompass.vue') }`.
- `frontend/src/components/NavBar.vue` (+ the app catalog/`applications.md`) — list the app.

**Interface consumed:** the Phase-3 REST surface via the shared `apiGet` wrapper (`api.js`).

**TDD (frontend):** if the frontend has a test runner (Vitest), add `ProteomeCompass.spec`
asserting the route resolves + `COMPASS_BASE` is wired; otherwise a lint/build check +
manual smoke is the gate. Commit.

### Task 4.2 — Protein page (4-column evidence-across-resources)

**Create:** `frontend/src/views/ProteomeCompass.vue` (shell + protein mode) +
`frontend/src/components/CompassProteinCard.vue`.
- 4 columns: **quantms | PeptideAtlas | UniProt | HPA** (design §6), a tissue-overlap strip,
  an agreement/disagreement banner (labeled "MS-concordant, not independent" where PA↔quantms),
  the evidence **tier badge**, the **`hpp_compliant`** flag + USIs, the pinned reference-proteome
  id next to any %, and deep links to quantms datasets. Renders **whatever sources exist** for
  the organism (3-column for non-human). **Reuse** the `ProteinProfile.vue` /
  `ProteinSequenceMap.vue` components' styling conventions.

**TDD:** component test (or manual smoke against a seeded backend) — a human acc shows 4
columns; a bacterium acc shows quantms+UniProt only, no null-column crash. Commit.

### Task 4.3 — Faceted set-query explorer (URL sync + presets + export)

**Create:** `frontend/src/components/CompassExplorer.vue` (+ explorer mode in the view).
- Facet controls for every dimension in `/facets`; a **one-click preset bar** (the design
  §6.5 named set-queries); a live count summary; a sortable protein table; CSV/parquet
  **export** buttons hitting `/query/export`.
- **URL sync** identical to `PeptideSearch.vue`: `useRoute`/`useRouter`, an `applyingRoute`
  guard against loops, `router.replace({ query })` (no history spam), and populate-from-URL
  on load so a filtered view is **shareable** (design "the URL captures it like peptide-search's
  sync").

**TDD:** exercise the URL round-trip (state → query → reload → same state) + a preset applies
the right facet set. Commit.

### Task 4.4 — PA-vs-quantms comparison

**Create:** `frontend/src/components/CompassComparison.vue`.
- Per-protein side-by-side (observation counts, tissue breadth, coverage) + a corpus-level
  **PA n_obs vs quantms n_obs** scatter/table to spot systematically over/under-sampled
  proteins (design §6.5 comparative view). **Reuse** `StatsChart.vue` for the scatter.

**TDD:** the scatter renders from a seeded `/query` result; the over/under-sampled presets
cross-link into the explorer. Commit.

### Task 4.5 — Gap Finder dashboards

**Create:** `frontend/src/components/CompassGapFinder.vue`.
- Coverage cards (each showing the pinned denominator), a **tier donut**, a **PE bar**, the
  **reanalysis-targets** table, **PE-upgrade candidates**, and a **tissue heatmap** (design §6).
  Human shows the tissue-gap map + HPP framing; sparse organisms show the UniProt-baseline
  coverage view honestly (with `n_datasets` visible).

**TDD:** dashboards render from seeded `/gaps/*`; a sparse organism shows the baseline view,
not an error. Commit.

### Task 4.6 — Taxonomy tree navigation

**Create:** `frontend/src/components/CompassTaxonomyTree.vue`.
- Collapsible clade tree from `/taxonomy`, per-node protein/coverage counts, and **scope any
  facet query to a clade** by writing `clade=` into the explorer's URL state (design §6.5).

**TDD:** clicking a clade node scopes the explorer query; collapse/expand works; an empty
subtree degrades gracefully. Commit.

### Task 4.7 — Docs group

**Create** `frontend/src/docs/`:
`compass-overview.md`, `compass-gaps.md` (Gap Finder + reanalysis/PE-upgrade),
`compass-explorer.md` (facets/presets/taxonomy), `compass-api.md` (REST + MCP).
**Modify** `frontend/src/docs/nav.js` — add a **"Proteome Compass"** group (the by-app docs
convention: one group per app, shared `compass-*` slug prefix). Add redirects if any slugs
move. Commit.

---

# PHASE 5 — Deploy (static-first) (1–2 days)

**Goal:** the batch Jobs + serving Deployment + Caddy route, matching the git-clone +
pip-install pod shape.

### Task 5.1 — Ingest + builder Job yamls

**Create** in `quantms-portal-backend/deploy/`:
- `compass-resolve-job.yaml`, `compass-uniprot-job.yaml`, `compass-peptideatlas-job.yaml`,
  `compass-hpa-job.yaml`, `compass-taxonomy-job.yaml` — one per ingest entry point.
- `compass-build-job.yaml` — the `quantms-portal-compass-build` profile-builder (larger
  mem, like the index jobs; an `emptyDir` work volume).
- All follow `enrich-job.yaml`/`index-job.yaml`: `git clone --depth 1 … && pip install
  --quiet /tmp/repo && exec <entrypoint>`, the `gh-pull` token + `s3-publish` creds + the
  `QMS_PORTAL_STORAGE_*` + Ceph-checksum env block, `restartPolicy: Never`, `backoffLimit:
  1`, `ttlSecondsAfterFinished`.
- Optionally a `compass-refresh-cronjob.yaml` cadence (bounded by PA/HPA/UniProt release
  cadence — irregular; a monthly re-run with `--skip-existing`-style pinning is enough).

**Verification:** `kubectl apply --dry-run` (or yaml-lint) the manifests; document the run
order in `deploy/README.md` (resolve → uniprot/pa/hpa/taxonomy → build). Commit.

### Task 5.2 — Serving Deployment + Service

**Create** `deploy/compass.yaml` — mirror `peptide-search.yaml`: Deployment (replicas 2,
RollingUpdate maxUnavailable 0), the git-clone+`uvicorn quantms_portal_backend.apps.
proteome_compass.api:app` command, `COMPASS_MANIFEST=quantms/apps/proteome-compass/db/
manifest.json`, `COMPASS_MANIFEST_POLL_SECONDS=120`, `APP_ROOT_PATH=/compass`, the storage
env block, `/health` startupProbe + `/ready` readinessProbe. **Lower resources than
peptide-search** — profiles are small, no heavy materialize (request ~1Gi, limit ~4Gi;
tune after first run). Add the `Service` (port 80 → 8080).

**Verification:** dry-run apply; confirm the readiness contract matches the API. Commit.

### Task 5.3 — Caddy route + frontend host + app registry

**Modify:**
- `deploy/README.md` "Caddy edge routes" — add `handle_path /compass/* { reverse_proxy
  proteome-compass.quantms-publish.svc.cluster.local:80 }` to the `api.quantms.org` block.
- The app-catalog / registry the portal reads (`render_apps_registry_key` /
  `render_app_manifest_key`) — register the `proteome-compass` app (id, title "Proteome
  Compass", route `/apps/compass`, `enabled: false` until `/health` is green, then flip).
- Confirm `config.js` `COMPASS_BASE` (Task 4.1) points at `${API_BASE}/compass`.

**Verification:** the health-gate curl (`curl https://api.quantms.org/compass/health`) is the
documented flip condition, as for peptide-search. Commit.

---

## Sequencing & the first shippable milestone

The design mandates: **lead with human richness, but ship the all-52-organism artifact in
v1.** The dependency-respecting order:

1. **Phase 0** (scaffolding) →
2. **Phase 1** ingest, but **resolve (1.1) + UniProt (1.2) first** — they are the spine and
   denominator for *all* organisms and unblock everything. PA (1.3) + HPA (1.4) add human
   richness; taxonomy (1.5) + ref-manifest (1.6) can land in parallel.
3. **Phase 2** builder — **build human first** (validate the 4-source join + tiers +
   gaps on the richest organism), then flip on the all-52 loop in the same job/run. The
   milestone artifact is the all-organism `protein_profile.parquet` + per-organism
   `gap_summary.json`.
4. **Phase 3** serving, **Phase 4** UI, **Phase 5** deploy.

> **Recommended first shippable milestone (v1-alpha):** Phases 0 → 1.1/1.2 → a
> **human-only** run of Phase 2 (Tasks 2.1–2.4) → Phase 3.1–3.3 → a minimal Phase 4
> protein page + Gap Finder. That puts a working `/compass` protein page + coverage/
> reanalysis dashboards + `/profile` + `/gaps` REST/MCP in front of users on the highest-
> payoff organism, on real artifacts, end to end. Then **broaden the same builder loop to
> all 52** (still v1) and add the faceted explorer (3.2/4.3), PA-vs-quantms (4.4), and the
> taxonomy tree (1.5/3.5/4.6). **neXtProt/HPP overlay is v2** and reshapes nothing (the
> `nextprot_pe`/`hpp_status` columns are already nullable in the schema).

## Risks & unknowns (carry into every relevant task)

- **Identity mapping (highest).** UniProt acc ↔ PA IDs ↔ HPA Ensembl-gene are not 1:1
  (isoforms, secondary accs, gene-vs-protein grain). Mitigation baked into Tasks 1.2/1.3/2.1:
  UniProt idmapping/xrefs as the single spine, keep secondary accs, treat HPA as gene-scoped,
  record match-method + unmapped-rate QC.
- **PA build availability + cadence.** Human-dominant, irregular; the `PA_BUILDS` registry is
  a manually-pinned unknown that must be verified per organism at ingest time. Organisms
  without a build degrade to null PA columns — never fatal.
- **Licensing.** HPA CC BY-SA on v21-and-earlier pins, PA per-build terms → stored per source
  in the ref-manifest and surfaced in the UI (Task 1.6).
- **Tissue-vocab reconciliation.** HPA vs quantms-SDRF vs PA tissue names differ; the OLS →
  UBERON/BTO mapping (reusing `tissue_map.py`) is best-effort with a surfaced unmapped-rate
  (Task 2.3).
- **Organism resolution noise.** Free-text SDRF names; the overrides map + species-first
  resolution + `unresolved_pct` QC (Task 1.1) handle it, but the microbiome long tail is the
  known soft spot.
- **MS-vs-MS circularity.** PA and quantms share PXDs; agreement is "MS-concordant, not
  independent" (labeled in Task 2.2); the orthogonal axis is HPA/UniProt/(neXtProt).
- **Sparse-organism GPP.** Reproducibility is weak by construction for single-dataset
  organisms; `quantms_observed` leans on per-dataset class-1 FDR + pGPP, `n_datasets` is
  always shown, and a low sparse GPP is never presented as "low quality" (Task 2.1). This is
  transient — it fills in as datasets accrue.

## Key new backend modules (summary)

`apps/proteome_compass/`: `reader.py`, `resolve.py`, `uniprot_ref.py`, **`peptideatlas.py`
(new feed)**, `hpa_profile.py`, **`taxonomy.py` (new feed)**, `ref_manifest.py`,
`schema.py`, `build_profile.py`, `reconcile.py`, `gaps.py`, `builder.py`, `index.py`,
`api.py`. Reused wholesale: `apps/duckdb_s3.py`, `apps/mcp_util.py`, `config.py`,
`storage.py`, `peptide_search/release.py` (manifest pattern), and the protein_metadata
ingest primitives (`proteome.py`, `hpa.py`, `enrich.py`/`reader.py`, `tissue_map.py`).

## Key new artifacts (summary)

`profiles/{organism}/{release}/{protein_profile.parquet, gap_summary.json,
tissue_gap_matrix.parquet, reanalysis_targets.parquet, pe_upgrade_candidates.parquet,
ref_manifest.json}`; `taxonomy_tree.json`; the serving `db/manifest.json` (atomic-flip
release pointer). All immutable, content-addressed, all-52-organism, nullable sources.
