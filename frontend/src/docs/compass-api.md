# API & MCP

Proteome Compass serves its data over REST at `${API_BASE}/compass` and over MCP at
`${API_BASE}/compass/mcp`. Everything is read-only; responses degrade to an empty,
well-keyed shape when a release is unavailable (consumers never break).

## REST

| Route | Returns |
|---|---|
| `GET /profile/{acc}?organism=` | the full 4-source record + tier + HPP flag + USIs (resolves secondary accessions) |
| `GET /query/facet?preset=&…` | the faceted protein set + live count (named presets: `pa_not_quantms`, `quantms_not_pa`, `pe_upgrade`, `dark`) |
| `GET /facets` | the facetable dimensions + value lists |
| `GET /gaps/summary?organism=` | coverage %s (with the pinned reference proteome) + by-tier/by-PE breakdowns |
| `GET /gaps/reanalysis-targets` | ranked T4 targets |
| `GET /gaps/pe-upgrades` | T2 PE-upgrade candidates |
| `GET /taxonomy?clade=` | the clade tree (or a subtree) with per-node counts |
| `GET /health`, `GET /ready` | liveness + readiness |

## MCP tools

`get_protein_profile`, `list_reanalysis_targets`, `list_pe_upgrade_candidates`,
`get_coverage_summary`, `browse_taxonomy` — each read-only, with the same result caps as
the REST routes.
