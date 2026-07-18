# quantms Protein Evidence Profiler — Design Proposal (brainstorm)

*A cross-resource protein-evidence profiler for the quantms portal. Design/brainstorming
deliverable for review — no implementation. Literature grounding (current + future uses) is
appended once the bibliography agents report.*

## 0. One-line pitch

For every protein in a proteome, put quantms's own MS evidence next to **PeptideAtlas, UniProt, and
the Human Protein Atlas** on a single record — and make the **gaps** (proteins/tissues/PE-levels
where we are behind, or ahead) first-class, queryable objects that drive reanalysis and acquisition
decisions. Builds on existing assets (24.5M-row peptide index, GPP/pGPP, UniProt-PE/HPA
protein-metadata) and fits the static-first S3-artifact + DuckDB-pod + Vue + MCP stack. Adds **three
external reference feeds + one join job** — no new database tier.

## 1. Questions it answers
**Per-protein page:** Is protein X seen by MS, and where? quantms confidence (GPP/pGPP, coverage,
#peptides, #datasets)? How does that compare to PeptideAtlas (canonical? #samples), UniProt (PE
level), HPA (RNA/IHC tissues, reliability)? Where do the four **disagree**?
**Corpus gap analysis:** % of UniProt proteome MS-covered by quantms vs PeptideAtlas; the
**PA-has-but-quantms-doesn't** reanalysis-target list; **UniProt PE2-5 with strong quantms
evidence** (PE-upgrade / missing-protein candidates); **tissues quantms under-covers vs HPA**
(acquisition-gap map); where quantms is uniquely ahead.
**Users:** HPP/missing-protein researchers, the quantms reanalysis team (what to run next),
biologists checking a protein, reviewers wanting provenance.

## 2. Per-release ingest (pin every source version in a ref-manifest)
- **UniProt** = the identity spine + proteome backbone: reference proteome (accessions,
  primary/secondary, gene names, sequences, **PE 1-5**, Ensembl/HGNC/GeneID xrefs). EBI reference
  proteomes FTP / `rest.uniprot.org` / idmapping. ~8-week releases; CC BY 4.0. **Canonical row key.**
- **PeptideAtlas** = external MS comparator: per-build `PAprotlist` (presence level:
  canonical/possibly-distinguished/subsumed/…), prot_map, `APD_*fasta`, per-sample tables
  (per-tissue observation counts/peptides), atlas_tables. peptideatlas.org/builds. **Irregular**
  (human ~annual, others rarer); pin build name/date. Drives PA-gap metrics. **Caveat: also MS.**
- **HPA** (human-only) = orthogonal (non-MS) + tissue reference: `rna_tissue_consensus.tsv` (nTPM),
  `normal_tissue.tsv` (IHC + reliability), `subcellular_location.tsv`, `proteinatlas.tsv.zip`.
  Versioned (v25.1, May 2026); **CC BY 4.0 now, CC BY-SA 3.0 for v21 & earlier — check the pin.**
- **(Optional) neXtProt/HPP overlay** (human): PE + missing-protein (PE2-4)/PE5 flags + the HPP
  ruleset. 2023 HPP: PE1 = 18,397/19,778 (93%), 17,453 by MS; missing (PE2-4) = 1,381. Turns
  PE-upgrade candidates into submittable HPP claims.
- **quantms internal** (local artifact read, not a download): the peptide index, GPP/pGPP,
  coverage_pct, provenance, SDRF-derived observed tissues.

## 3. Data model — one row per (uniprot_acc, organism, release)
identity (uniprot_acc PK + secondary accs, gene, ensembl xrefs, taxon, seq_len) · existence
(uniprot_pe, nextprot_pe, hpp_status) · ms_evidence_quantms (observed, pgpp, best_peptide_gpp,
n_unique_peptides, n_datasets, coverage_pct, observed_tissues[]) · ms_evidence_peptideatlas
(pa_presence_level, pa_observed, pa_n_samples, pa_n_tissues, pa_observed_tissues[]) ·
tissue_evidence_hpa (rna_tissues[nTPM], protein_tissues[IHC+reliability], subcellular[],
reliability) · reconciled (evidence_tier, gap_flags[], agreement_summary) · provenance
(ref_manifest_id). Reference versions in a sidecar manifest, not per row.

**Reconciled evidence tier (stored, not query-time):**
- **T1 Multi-resource confirmed** — quantms observed + PA canonical + UniProt PE1
- **T2 MS-confirmed / PE-upgrade candidate** — quantms + PA observed but PE<1 / HPP-missing
- **T3 quantms-unique MS** — quantms observed, not PA-canonical → novel/recovered, review
- **T4 PA-only MS** — PA observes, quantms doesn't → **reanalysis target**
- **T5 Transcript/other only** — HPA RNA or PE2-3, no MS
- **T6 Dark** — PE4/5 or no evidence

## 4. Gap metrics + lists (the core value)
Corpus metrics per organism/release: `pct_uniprot_covered_quantms`, `pct_uniprot_covered_pa`
(same denominator), `pct_pa_recovered_by_quantms`, `pct_quantms_unique`, + breakdowns by PE and
tier. Prioritized lists (filtered views over one parquet): (1) **reanalysis targets** (T4, ranked by
PA n_samples × tissue breadth, filtered to not-yet-reanalyzed PXDs — feeds the reanalysis queue);
(2) **PE-upgrade / missing-protein candidates** (T2, strict pGPP + ≥2 unique peptides across ≥2
datasets, HPP-guideline framed); (3) **quantms-unique** (T3); (4) **tissue acquisition-gap map**
(HPA-expressed vs quantms-observed per tissue); (5) **disagreement list**.

## 5. Architecture (static-first — no new tier)
`profile-builder` batch job (per release/organism): fetch+pin sources → normalize to the UniProt
spine → join 4 sources + quantms internal → reconcile tier/flags → aggregate corpus summary + tissue
matrix → emit immutable S3 artifacts. Artifacts:
`s3://…/protein-profiler/{organism}/{release}/`: `protein_profile.parquet`, `gap_summary.json`,
`tissue_gap_matrix.parquet`, `reanalysis_targets.parquet`, `pe_upgrade_candidates.parquet`,
`ref_manifest.json`. Stateless DuckDB-over-S3 query pods serve REST (`/profile/{acc}`,
`/gaps/summary`, `/gaps/reanalysis-targets`, `/gaps/pe-upgrades`, `/gaps/tissue-map`, `/search`) +
MCP tools (`get_protein_profile`, `list_reanalysis_targets`, `list_pe_upgrade_candidates`,
`get_coverage_summary`, `find_tissue_gaps`). New Vue view.

## 6. UI — protein page (4-column evidence-across-resources: quantms | PeptideAtlas | UniProt | HPA
+ tissue-overlap strip + agreement/disagreement banner + evidence tier + deep links to quantms
datasets) and gap dashboards (`/gaps`: coverage cards, tier donut, PE bar, reanalysis-targets table,
PE-upgrade candidates, tissue heatmap).

## 7. Naming
1. **quantms Proteome Compass** (recommended; `/compass`; gap dashboards = "Gap Finder")
2. ProteoGap / Evidence Gap Profiler
3. CrossProt / Confluence

## 8. Risks
- **Identity mapping (highest):** UniProt acc ↔ PA IDs ↔ HPA Ensembl-gene not 1:1 (isoforms,
  secondary accs, gene-vs-protein grain). Mitigate: UniProt idmapping/xrefs as the single spine,
  keep secondary accs, record match method + unmapped-rate QC; treat HPA fields as gene-scoped.
- **MS-vs-MS circularity:** PA and quantms are both MS and share PXDs → "agree" is not independent.
  Mitigate: HPA/UniProt/neXtProt non-MS is the orthogonal axis; report PA↔quantms dataset overlap;
  label agreements MS-concordant not independent.
- **PA build cadence/scope** (human-dominant, irregular) → freshness bounded by PA; degrade
  gracefully (null PA cols). **Organism scope:** HPA/neXtProt human-only → 3-source profile for
  others. **Licensing:** HPA SA on older pins, PA per-build terms — store license per source.
  **Tissue vocab mismatch** → map all to UBERON/BTO via OLS (harmonizer tooling exists).
  **PE-upgrade rigor** → frame T2 as candidates, HPP-guideline filter. **Denominator drift** → pin
  + display the reference-proteome ID wherever a % appears.

## Scope — ALL corpus species (decided), with per-organism source availability

v1 covers **every organism in the quantms corpus**, not human-only — more robust and, because the
data model is already keyed on `(uniprot_acc, organism)` with nullable source columns and
organism-partitioned artifacts, essentially free architecturally. The builder simply iterates the
corpus organisms; each protein page/dashboard renders whatever sources exist for that organism.

**Concrete scope (live corpus, 52 organisms):** homo sapiens (171 datasets), mus musculus (7),
danio rerio / herpes simplex (2 each), then **~48 single-dataset organisms** (gut-microbiome
bacteria, viruses, plants, fungi, model organisms). So the source coverage is tiered:

| Source | Availability across the 52 | Gives |
| --- | --- | --- |
| **UniProt** reference proteome + PE | **all 52** (identity spine + denominator) | coverage % + PE-upgrade candidates everywhere |
| **quantms** MS evidence | **all 52** | the observed set + confidence |
| **PeptideAtlas** build | only where a build exists — human, mouse, and a few model organisms in the corpus (e.g. *A. thaliana*, *D. melanogaster*, *D. rerio*, *E. coli*, yeast) | reanalysis targets + external MS recovery |
| **HPA** (RNA/IHC) | **human** (some mouse) | tissue reference + orthogonal (non-MS) axis |
| **neXtProt/HPP** overlay | **human** | HPP missing-protein framing |

**Value tiers that fall out of this:**
- **Rich, multi-resource** (human; mouse; the ~5-8 PA-covered model organisms): full gap analysis,
  reanalysis targets, and — human only — the tissue acquisition-gap map and HPP framing.
- **UniProt baseline** (the ~44 single-dataset organisms): "what % of this organism's reference
  proteome did our (one) dataset cover, and which PE2-5 proteins did we nonetheless see" — still a
  genuinely useful proteome-coverage + PE-upgrade view, with PA/HPA columns simply absent.

**All-species ingest wrinkle — organism resolution.** Corpus organism names are free-text SDRF and
noisy (typos like "akkermansia muciniphilia", "mycoplasmen"; missing strain; "drosophila" vs
"drosophila melanogaster" as two entries). Going all-species needs an **organism → NCBI taxon →
UniProt reference proteome** resolution step (the OLS/taxonomy harmonizer tooling in the workspace
can drive it), with an unresolved-organism QC metric per release. Human/mouse/model organisms resolve
cleanly; the microbiome long tail needs this normalization before the UniProt join.

**Sparsity caveat baked in:** for single-dataset organisms the GPP **reproducibility** signal is weak
by construction (it needs many independent datasets; sparse/non-human organisms cap low). So for
those, the `observed` flag must lean on the per-dataset (class-1 FDR) evidence + pGPP's non-
reproducibility features, NOT on cross-study re-detection — and the UI should show `n_datasets` so a
single-study call is transparent. Do not present a low sparse-organism GPP as "low quality"; it is
"not enough independent evidence *here*."

## First build slice
Still lead with **human** (the richest 4-source join + the reanalysis-targets + tissue-gap
dashboards — highest payoff), but ship the **all-organism `protein_profile.parquet` + per-organism
`gap_summary.json`** in the same v1 by looping the builder over all 52 (UniProt+quantms for every
organism; PA/HPA where present). neXtProt/HPP overlay can follow as v2 without reshaping anything.

## Verified sources
PeptideAtlas builds/bulk downloads + format help + THISP; HPA download + licence; UniProt website
API (NAR 2025) + EBI reference proteomes; 2023 HUPO HPP report (PE1 18,397/19,778; missing 1,381).

---

## Literature grounding

*Citations retrieved/verified via PubMed + Europe PMC. Percentages compare only within one stated
reference release (the denominator moved 19,778 neXtProt → 19,411 GENCODE in 2024).*

### A. How MS protein-evidence resources are used TODAY — the ecosystem this app plugs into
The field runs a **federated division of labor** codified by the HUPO Human Proteome Project (HPP):
raw data in **ProteomeXchange** (PRIDE/MassIVE/jPOST/iProX/Panorama/PeptideAtlas — **64,330 datasets
by June 2025**, ~47% in the last 3 years; Deutsch, *NAR* 2026, doi:10.1093/nar/gkaf1146); uniform
**reanalysis** by **PeptideAtlas** + **MassIVE-KB** (Wang, *Cell Syst* 2018,
doi:10.1016/j.cels.2018.08.004 — 19,610 proteins / 97%); **curation** by **neXtProt** (retired 2024
→ **UniProtKB + Ensembl-GENCODE** now the reference); **orthogonal antibody+RNA** by **HPA** (Uhlén,
*Science* 2015, doi:10.1126/science.1260419). **quantms would slot in as a new PeptideAtlas/
MassIVE-KB-like MS contributor at the protein level** — exactly the seam this app targets.

Dominant biologist use-cases: (1) the **PE1 "credibly detected?" call**; (2) the **missing-protein
(PE2-4→PE1) hunt** — the flagship HPP effort (neXt-MP50 Chr17 validated 43 new PE1: 25 by MS;
Siddiqui/Omenn, *JPR* 2018, doi:10.1021/acs.jproteome.8b00442); (3) **HPP guidelines 3.0** as the
rulebook — ≥2 unique ≥9-aa peptides, global class-1 FDR, **USI-referenced spectra** (Deutsch, *JPR*
2019, doi:10.1021/acs.jproteome.9b00542); (4) **MS ⇄ antibody ⇄ RNA reconciliation** — >500 IHC-
negative proteins robustly seen by MS in kidney (Acoba, *J Nephrol* 2024,
doi:10.1007/s40620-024-02126-z); (5) tissue/abundance priors (ProteomicsDB, HPA); (6) proteogenomics.

**Coverage state:** ~**93% PE1** but only ~**88% by MS** (17,453/19,778 in 2023; Omenn *JPR* 2024,
doi:10.1021/acs.jproteome.3c00591) — **the MS-only number is quantms's honest coverage metric and
its frontier.** The ~1,300 **missing proteins** are systematically GPCRs/olfactory receptors,
membrane transporters, and low-abundance/tissue-restricted (testis, brain) proteins — the same class
where antibody/RNA evidence exists without MS (the reconciliation hot-zone; Dong/Omenn *JPR* 2015).

**Reconciliation cautions baked into the design:** the gene-count denominator is contested and moved
(Ezkurdia *HMG* 2014, doi:10.1093/hmg/ddu309); "canonical protein" ≠ proteoform truth (Aebersold
*Nat Chem Biol* 2018, doi:10.1038/nchembio.2576); aggregated MS over-calls without global FDR (why
PA/MassIVE-KB reprocess). → **the app must pin the reference target list, meet HPP strictness, emit
USIs, and present the three evidence axes side-by-side (discordance is informative, not error).**

### B. FUTURE uses a quantms-scale evidence corpus enables
- **Completing the proteome / missing proteins** — a growing harmonized reanalysis corpus is the
  engine that converts PE2-4 and closes the MS-only gap (HPP reports).
- **AI over the corpus** — aggregated, harmonized MS is training data for peptide-property models
  (detectability/RT/CCS/fragment-intensity: AlphaPeptDeep *Nat Commun* 2022,
  doi:10.1038/s41467-022-34904-3; DeepLC *Nat Methods* 2021) and **rescoring** that recovers +36-46%
  IDs with no new experiments (MS²Rescore, *MCP* 2022, doi:10.1016/j.mcpro.2022.100266); de novo
  (Casanovo, *Nat Commun* 2024, trained on 30M spectra). Reviews explicitly cite "need for
  large-scale harmonized datasets" (Angelis, *Proteomics* 2025) — the justification for this resource.
  *(Honest flag: no published **MCP-agent-over-proteomics** exists yet — that framing is novel.)*
- **Tissue/disease/single-cell & spatial atlases** — MS-backed, cell-type + spatially resolved
  expression beyond antibody/transcript inference (Guo/Steen/Mann *Nature* 2025,
  doi:10.1038/s41586-025-08584-0; Mund/Mann *Mol Cell* 2022).
- **PTMs at scale** — a queryable, functionally-scored, disease-contextualized site atlas (Ochoa
  *Nat Biotech* 2019 reanalyzed 112 datasets → 119,809 sites + functional score; kinome atlas Johnson
  *Nature* 2023).
- **Clinical / drug-target** — population plasma proteomics + genetics for MR target de-risking
  (UKB-PPP *Nature* 2023, doi:10.1038/s41586-023-06592-6); MS reanalysis adds an **orthogonal** axis
  to the affinity-platform (Olink/SomaScan) work whose cross-platform agreement is only modest.
- **Re-detection as a decoy-free quality standard** — exactly quantms's GPP held-out re-detection;
  a differentiator vs. per-study FDR.

**Top-5 capabilities to aim for:** (1) be a **PE1/missing-protein evidence contributor** with USIs +
HPP-guideline compliance; (2) a **reanalysis-targeting engine** (gap-driven); (3) **AI-ready
training/rescoring substrate**; (4) an **MS-backed tissue/PTM atlas** reconciled with HPA; (5)
**agent/MCP-native** access (novel).

### Strategic reframing of the app (from the literature)
The "Proteome Compass" is not just an internal QC tool — positioned right, it is **quantms's entry
into the HPP federated ecosystem as a new MS-reanalysis evidence contributor**, with the gap
analysis = the community's missing-protein frontier, and the corpus = a future AI/atlas/clinical
substrate. Design consequences to add to §3-4: store **USIs** on quantms evidence, an **HPP-guideline
compliance flag** per protein, and **pin+display the reference target list** on every coverage %.
