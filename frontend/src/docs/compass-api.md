# API & MCP

Proteome Compass serves its data over REST at `${API_BASE}/compass` and over MCP at
`${API_BASE}/compass/mcp`. Everything is read-only; responses degrade to an empty,
well-keyed shape when a release is unavailable (consumers never break).

## REST

| Route | Returns |
|---|---|
| `GET /organisms` | the per-organism scoreboard rows (proteome sizes, dual-denominator coverage, GPP-passing, tier mix, headroom, common name + kingdom) — manifest-derived, no scan |
| `GET /profile/{acc}?organism=` | the full 4-source record + tier + HPP flag + USIs + typed discordances (resolves secondary accessions) |
| `GET /query/facet?preset=&organism=&…` | the faceted protein set + live count (named presets: `pa_not_quantms`, `quantms_not_pa`, `pe_upgrade`, `dark`, `swissprot_gap`) |
| `GET /facets` | the facetable dimensions + value lists |
| `GET /gaps/summary?organism=` | dual-denominator coverage %s (with the pinned reference proteome) + by-tier/by-PE breakdowns + reanalysis headroom |
| `GET /gaps/reanalysis-targets` | ranked T4 targets |
| `GET /gaps/pe-upgrades` | T2 PE-upgrade candidates |
| `GET /taxonomy?clade=` | the clade tree (or a subtree) with per-node counts |
| `GET /health`, `GET /ready` | liveness + readiness |

## MCP tools

`get_protein_profile`, `list_reanalysis_targets`, `list_pe_upgrade_candidates`,
`get_coverage_summary`, `list_proteomes`, `browse_taxonomy` — each read-only, with the same
result caps as the REST routes.

## Shareable URLs

Every view in the web app is deep-linkable — its state lives in the query string, so any
screen can be bookmarked or shared:

- `/apps/compass?mode=proteomes` — the scoreboard
- `/apps/compass?mode=gaps&organism=homo-sapiens` — Gap Finder for an organism
- `/apps/compass?mode=protein&acc=P04637` — a protein passport
- `/apps/compass?mode=explore&preset=dark` — the Explorer with a preset
