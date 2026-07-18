# Peptide & Protein Search — API & MCP

Everything the Peptide & Protein Search view does is a plain HTTP API, and every query is also
exposed as an **MCP tool** for AI agents — the exact same call, the exact same result. Nothing here
requires authentication; the data is public and read-only.

- **REST base:** `https://api.quantms.org/peptide-search`
- **MCP endpoint:** `POST https://api.quantms.org/peptide-search/mcp` (Streamable-HTTP; tools listed below)
- **Interactive docs:** the OpenAPI/Swagger UI is served under the app base.

## The GPP filter — one parameter, `gpp_min`

Every search and profile call accepts an optional **`gpp_min`** (a number in `[0, 1]`):

- **Omit it** → all evidence is returned (unfiltered).
- **Set it** → only evidence with **GPP ≥ `gpp_min`** is kept. The value *is* the cutoff, so the
  request reads literally as "GPP ≥ 0.85".
- The web app's **default** cutoff is dynamic (calibrated to a 5% false-discovery rate each release)
  and is served at `GET /stats` under `gpp.default_min`. See [Evidence quality (GPP)](/docs/ps-gpp).

*(The legacy `qc` / `qc_threshold` parameters were replaced by `gpp_min`.)*

## Search endpoints

| Endpoint | What it returns |
| --- | --- |
| `GET /search/peptide` | Datasets containing a peptide. `sequence` + `match` = `exact` \| `contains` \| `peptidoform`. |
| `GET /search/protein` | Datasets containing a protein (UniProt accession or protein/gene name; gene-centric). |
| `GET /search/gene` | Datasets containing a gene (taxon-scoped over the stored genes column). |

Shared query parameters: `organism` (exact), `tissue` / `instrument` (substring), `collection`,
`min_length` / `max_length`, `modification` + `residue`, `limit` (≤ 500), `offset` (deep-pagination
capped), and `gpp_min`. Responses carry `total_datasets`, a `datasets` list, `unmapped`, and a
query-scoped `organism_facet`.

## Profile & coverage endpoints

| Endpoint | What it returns |
| --- | --- |
| `GET /peptide/profile` | A peptide's biological profile — species, tissues, diseases, proteotypicity, mapped proteins, PTMs. |
| `GET /protein/profile` | A protein's aggregated profile; with `gpp_min`, aggregates restrict to high-confidence rows, and an additive `gpp` sub-object always carries the high-confidence counterpart counts. |
| `GET /protein/coverage-map` | Per-residue depth, normalized intensity and PTM sites along the canonical sequence. |
| `GET /peptidoforms` | The peptidoforms (modified forms) matching a sequence. |

## Corpus & vocabulary endpoints

| Endpoint | What it returns |
| --- | --- |
| `GET /stats` | Corpus size (datasets/peptides/peptidoforms/rows), the observation distribution, and the `gpp` block (dynamic `default_min`, target FDR, high-confidence counts). |
| `GET /facets` | The organism / collection / instrument facet vocabularies. |
| `GET /modifications` | The modification vocabulary (name → residues), each classified biological vs. artifact/label. |
| `GET /health`, `GET /ready` | Liveness (always 200) and readiness (503 while the index warms). |

## MCP tools (for AI agents)

The same functions are exposed as MCP tools, so an assistant can run them directly:
`search_peptide`, `search_protein`, `search_gene`, `get_peptide_profile`, `get_protein_profile`,
`get_protein_coverage_map`, `list_peptidoforms`, `list_modifications`, `list_facets`. Each mirrors
its REST parameters (including `gpp_min`, `limit`, `offset`) and re-applies the same cost limits, so
the agent path can't bypass them. Tools are annotated read-only. See [AI & MCP](/docs/ai-mcp) for the
agent model.
