# portal.quantms.org — Design Specification

## Overview

portal.quantms.org is an AI-first proteomics data portal that serves standardized QPX datasets organized into collections. It replaces the static quantms.org/datasets page with a queryable, programmable resource for AI agents, bioinformaticians, and researchers.

**Priority users (in order):** AI agents/tools > bioinformaticians building ML pipelines > biologists exploring protein expression.

**Core principle:** Schema-first, SQL-driven access. The AI reads the schema, writes DuckDB SQL, gets results. No pre-computed query patterns — full query freedom over parquet data.

## System Architecture

Two-tier progressive enhancement: **static-first** (always works, zero backend) with optional **backend enhancement** (search, SQL, MCP).

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  TIER 1: STATIC (always works, zero backend)                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  GitHub Pages                                                 │  │
│  │  ├── Vue 3 SPA (Vite)                                         │  │
│  │  └── /data/                       ← pre-baked JSON at build   │  │
│  │      ├── registry.json            ← collection listing        │  │
│  │      ├── global-stats.json        ← charts data               │  │
│  │      └── collections/                                         │  │
│  │          ├── msnet/collection.json ← dataset table data       │  │
│  │          └── msnet/datasets/PXD000865.json ← detail page      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  TIER 2: BACKEND (enhances when available)                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  FastAPI VM                                                   │  │
│  │  ├── DuckDB → S3 parquets (SQL queries, search)              │  │
│  │  ├── REST API (POST /api/v1/query)                            │  │
│  │  └── Remote MCP (/mcp)                                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  S3: s3://quantms-portal/                                           │
│  └── Full QPX parquet datasets (bulk download via qpx pull)         │
│                                                                     │
│  Local MCP (pip install quantms-mcp)                                │
│  ├── Proxies to remote FastAPI for queries                          │
│  ├── qpx pull → download from S3                                    │
│  └── quantms_query_local → DuckDB on local files                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Design principle:** The portal MUST work with Tier 1 alone. Tier 2 enhances but never enables. If the FastAPI VM goes down, users can still browse all collections, view all datasets, see all statistics, and get download commands. Only search and SQL queries require the backend.

**Implementation phases:**
- **Phase 1 (shippable MVP):** qpx static data generator + Vue app reading static JSON → deploy to GitHub Pages. Portal is live with zero infrastructure cost.
- **Phase 2 (enhancement):** FastAPI backend + MCP → search, SQL, AI access. Portal gracefully degrades if backend is unavailable.

### 1. Vue 3 Web App (GitHub Pages)

- **Stack:** Vue 3 + Composition API, Vite, Vue Router (hash mode for GitHub Pages)
- **Hosting:** GitHub Pages — static build, GitHub Actions CI/CD
- **Styling:** Existing design system from prototype (blue/indigo/violet palette, Inter font, JetBrains Mono for code)
- **Data:** Two-tier — static JSON from `/data/` for browsing, FastAPI for search/queries
- **API base URL:** Configurable via environment variable (dev/staging/prod)
- **No state management library** — Vue 3 composables + reactive refs sufficient

**Routes and data sources:**

| Route | Page | Tier 1 (Static) | Tier 2 (Backend) |
|-------|------|-----------------|------------------|
| `/` | Home — hero, stats, collection cards | `registry.json` | — |
| `/collections` | All collections list | `registry.json` | — |
| `/collections/:name` | Collection detail — dataset table, filters, stats | `collections/{name}/collection.json` | — |
| `/collections/:name/:pxd` | Dataset detail — metadata, samples, download | `collections/{name}/datasets/{pxd}.json` | — |
| `/search` | Cross-collection peptide/protein search | — (shows "backend required" message) | `POST /api/v1/query` |
| `/statistics` | Global stats (organisms, workflows, years) | `global-stats.json` | — |
| `/api` | API documentation, MCP setup guide | Static content | — |

**Freshness and UX indicators:**

The Vue app must clearly communicate data freshness and backend availability:

- **Build timestamp:** Every static JSON file includes `"generated_at": "2026-04-09T12:00:00Z"`. The footer shows "Data last updated: April 9, 2026".
- **Backend status indicator:** A small dot in the nav bar — green when FastAPI is reachable, gray when not. Checked on app load via `GET /health`.
- **Search page:** When backend is unavailable, shows: "Cross-collection search requires the query service. You can still browse all collections and datasets below."
- **Dataset detail:** Shows "Pre-computed summary" label on static sections. If backend is available, an expandable "Run SQL query" section appears.

### 2. S3 Data Layer

All data stored as parquet. No JSON, no YAML — parquet all the way down. Follows existing qpx collection conventions.

**S3 layout:**

```
s3://quantms-portal/
├── registry.parquet                         ← lists all collections + summary stats
└── collections/
    ├── msnet/                               ← qpx collection (directory convention)
    │   ├── _index/                          ← reserved prefix per qpx spec
    │   │   ├── peptide/                     ← partitioned by first 2 amino acids (~400 partitions)
    │   │   │   ├── _metadata.parquet        ← build time, datasets_included, total_entries
    │   │   │   ├── AA/part-0.parquet
    │   │   │   └── ...
    │   │   ├── protein/                     ← partitioned by first 2 chars of accession
    │   │   │   ├── _metadata.parquet
    │   │   │   └── ...
    │   │   └── metadata/
    │   │       └── metadata.parquet         ← aggregated sample/run across datasets
    │   ├── PXD000865/                       ← dataset (has *.dataset.parquet → recognized)
    │   │   ├── PXD000865.dataset.parquet
    │   │   ├── PXD000865.sample.parquet
    │   │   ├── PXD000865.run.parquet
    │   │   ├── PXD000865.provenance.parquet
    │   │   ├── PXD000865.ontology.parquet
    │   │   └── psm/                         ← hive-partitioned
    │   │       └── organism=Homo_sapiens/
    │   │           └── run=file1.raw/part-0.parquet
    │   └── PXD001234/
    │       └── ...
    │
    ├── absolute-expression/
    │   ├── _index/
    │   │   ├── protein/
    │   │   ├── de/
    │   │   └── metadata/
    │   └── datasets (PXD002004, PXD004352, ...)
    │
    └── differential-expression/
        ├── _index/
        │   ├── de/
        │   └── metadata/
        └── datasets (PXD033169, ...)
```

**Discovery rules (from qpx spec):**
- Any subfolder of a collection containing `*.dataset.parquet` is a dataset
- Folders starting with `_` are reserved infrastructure (indexes)
- No manifest file needed — the filesystem IS the manifest

**Collection indexes (from qpx spec):**

| Index | Location | Partitioned By | Key Columns |
|-------|----------|----------------|-------------|
| Peptide | `_index/peptide/` | First 2 amino acids | sequence, peptidoform, project_accession, charge_states, spectra_count, best_pep, protein_accessions |
| Protein | `_index/protein/` | First 2 chars of accession | anchor_protein, protein_accessions, project_accession, gg_names, global_qvalue, num_peptides, num_runs |
| Differential Expression | `_index/de/` | First 2 chars of accession | protein_accession, gene_name, project_accession, contrast, log2_fold_change, adj_pvalue, regulation |
| Metadata | `_index/metadata/` | — | dataset, organism, tissue, instrument, samples, runs, psm_count |

Each index has `_metadata.parquet` with build info and staleness detection. Indexes are rebuilt by `qpx rebuild-index` when datasets are added. Each collection defines its own indexes tailored to its use case.

**What the portal adds vs what qpx provides:**

| Component | Provided By | Notes |
|-----------|-------------|-------|
| QPX dataset format | qpx | Already exists |
| Collection discovery & DuckDB engine | qpx | DatasetCollection class |
| Index build & partitioning | qpx | _index/ convention |
| S3 hosting & layout | portal | S3 bucket structure |
| registry.parquet | portal | Pre-computed summary for Vue app |
| FastAPI query service | portal | REST + MCP wrapping qpx DuckDB |
| Vue web app | portal | Dataset browser, collection pages |
| MCP server (remote + local) | portal | AI access layer |

### 3. FastAPI VM

A small VM running FastAPI with DuckDB for query execution.

**Lazy loading strategy:**
- **At startup:** Load `registry.parquet` + all collection metadata (lightweight — dataset, sample, run structures). Always warm. Also pre-load all collection indexes at startup — at current data sizes (890K peptide rows, 42K protein rows) the memory cost is acceptable and eliminates the lazy-load write-lock problem under concurrent requests.
- **Future scale:** When index sizes grow beyond available RAM, switch to on-demand loading with per-collection asyncio locks (double-checked loading pattern) and TTL-based eviction. DuckDB `SET temp_directory` for spill-to-disk as a safety net.

**Collection isolation:**
- Each collection gets a **separate DuckDB connection** (or schema namespace). User SQL executes only against the target collection's tables/views. A request with `collection: "msnet"` cannot access `absolute_expression_*` tables.
- This prevents cross-collection data access and simplifies the concurrency model.

**Concurrency model:**
- Single DuckDB process with multiple read-only connections (DuckDB supports concurrent reads since v0.9+).
- All indexes pre-loaded at startup — no write operations during request serving, eliminating the write-lock contention problem.
- Per-query resource limits (`memory_limit`, `threads`) prevent any single query from monopolizing the VM.
- Global concurrency cap: reject new queries if 5 are already executing (circuit breaker).

**Local metadata DB (fast path for web app):**
- A lightweight DuckDB file on the VM's local disk mirrors key metadata from `registry.parquet` and collection metadata indexes.
- Rebuilt by `qpx update-registry`. Always warm, no S3 dependency.
- The Vue web app's predictable queries (collection listing, dataset tables, stats) hit this local DB for sub-100ms responses.
- The SQL query endpoint (`POST /api/v1/query`) remains for AI agents and cross-collection search — these can tolerate higher latency.

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/collections` | GET | List all collections from registry.parquet |
| `/api/v1/collections/{name}` | GET | Collection detail + available structures |
| `/api/v1/collections/{name}/schema` | GET | Full schema for collection (all structures) |
| `/api/v1/collections/{name}/schema/{structure}` | GET | Schema for specific structure (columns, types, sample rows, hints) |
| `/api/v1/query` | POST | Execute DuckDB SQL against a collection |
| `/api/v1/collections/{name}/datasets/{pxd}/download` | GET | S3 URLs + qpx pull command |
| `/mcp` | Streamable HTTP | Remote MCP server endpoint (Streamable HTTP, not SSE — SSE deprecated in MCP spec June 2025) |
| `/health` | GET | Health check — DuckDB responsiveness + S3 connectivity (for load balancer) |

**Query endpoint (`POST /api/v1/query`):**

Request:
```json
{
  "sql": "SELECT sequence, COUNT(*) FROM peptide_idx WHERE sequence = 'TYQGSYGFR' GROUP BY 1",
  "collection": "msnet"
}
```

Response:
```json
{
  "columns": ["sequence", "count"],
  "rows": [["TYQGSYGFR", 1234]],
  "row_count": 1,
  "truncated": false
}
```

**Query sandbox (safety) — hard requirements:**

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max rows returned | 1,000 | Injected server-side via `SELECT * FROM (...user_sql...) LIMIT 1000` — not post-execution truncation |
| Query timeout | 30 seconds | Prevents runaway scans |
| Read-only | Enforced | No CREATE, INSERT, UPDATE, DELETE, DROP |
| Collection scoping | Enforced | Separate DuckDB connection/schema per collection. User SQL executes in isolated namespace — cannot reference other collections' tables |
| Response size | ~5 MB max | Prevents memory issues |
| Per-query memory | Capped via `SET memory_limit` | Prevents OOM from bad queries (e.g., CROSS JOINs) |
| Per-query threads | `SET threads = 2` | Limits CPU per query so one bad query cannot saturate all cores |
| Rate limiting | 10 req/min per IP, 5 concurrent queries global | Prevents DoS from loops or abuse |

**DuckDB hardening (non-negotiable startup config):**

These settings MUST be applied at DuckDB startup before any user query is accepted:

```python
conn.execute("SET enable_external_access = false")    # blocks filesystem, HTTP, non-configured S3
conn.execute("SET disabled_filesystems = 'LocalFileSystem'")  # explicitly blocks local paths
conn.execute("SET memory_limit = '4GB'")               # adjust per VM size; prevents OOM
conn.execute("SET threads = 2")                         # limit parallelism per connection
conn.execute("SET lock_configuration = true")           # MUST be last — prevents SQL from changing settings
```

Without these settings, DuckDB's built-in functions (`read_text('/etc/passwd')`, `read_blob('/proc/self/environ')`) bypass read-only enforcement entirely. This is the same vulnerability class as CVE-2024-9264 (Grafana/DuckDB, CVSS 9.9).

**SQL pre-filter (AST-level, mandatory):**

All user SQL must be parsed with `sqlglot` (DuckDB dialect) before execution. Reject queries containing:

| Category | Blocked |
|----------|---------|
| DDL/DML | `CREATE`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `GRANT` |
| I/O functions | `read_text`, `read_blob`, `read_file`, `write_file`, `read_csv`, `read_json`, `sniff_csv`, `glob` |
| External access | `ATTACH`, `DETACH`, `COPY`, `EXPORT`, `LOAD`, `INSTALL` |
| Config | `PRAGMA`, `SET` |
| Introspection | `duckdb_secrets`, `duckdb_settings`, `duckdb_views`, `duckdb_tables`, `duckdb_extensions`, `duckdb_columns` |
| Dangerous patterns | `CROSS JOIN`, raw `parquet_scan()`/`read_parquet()` with user-supplied paths, any `s3://` literal not matching `s3://quantms-portal/` |

Use `sqlglot` AST parsing — not regex. SQL obfuscation (mixed case, inline comments, Unicode) defeats regex.

**Structured error responses (for AI agents):**

```json
{
  "error": "timeout",
  "message": "Query exceeded 30s timeout",
  "hint": "Add WHERE clause on partition column (organism, run_file_name) to enable predicate pushdown"
}
```

AI agents need structured errors with actionable hints to self-correct. HTTP 500s are not acceptable.

**Schema response design (what the AI sees):**

```json
{
  "collection": "msnet",
  "structures": {
    "dataset": {"rows": 12, "columns": ["project_accession", "title", "organism"]},
    "sample": {"rows": 576, "columns": ["sample_id", "project_accession", "organism", "tissue"]},
    "psm": {"rows": "~45M", "columns": ["peptidoform", "sequence", "charge", "score"],
            "partitioned_by": ["organism", "run_file_name"]}
  },
  "indexes": {
    "peptide": {"rows": "~890K", "columns": ["sequence", "peptidoform", "project_accession", "spectra_count"],
                "partitioned_by": "first_2_aa"},
    "protein": {"rows": "~42K", "columns": ["anchor_protein", "project_accession", "num_peptides"],
                "partitioned_by": "first_2_chars"}
  }
}
```

Per-structure detail includes column types, sample rows, partition info, and performance hints (e.g., "Filter on partition columns for fast queries").

**DuckDB setup at startup:**

```python
# Register S3 parquets as views
CREATE VIEW msnet_dataset AS SELECT * FROM parquet_scan('s3://quantms-portal/collections/msnet/*/*.dataset.parquet');
CREATE VIEW msnet_sample AS SELECT * FROM parquet_scan('s3://quantms-portal/collections/msnet/*/*.sample.parquet');

# Heavy indexes loaded on demand
# On first peptide query:
CREATE TABLE msnet_peptide_idx AS SELECT * FROM parquet_scan('s3://quantms-portal/collections/msnet/_index/peptide/**/*.parquet', hive_partitioning=true);
```

**Scalability considerations:**
- **Partitioning:** QPX already uses hive partitioning (PSMs by organism/run, indexes by first 2 chars)
- **Concurrent reads:** Multiple read-only DuckDB connections within a single process (supported since DuckDB v0.9+)
- **Query constraints:** Server-side LIMIT injection, timeouts, per-query memory/thread caps, collection-scoped isolation
- **Caching:** LRU cache for common queries, keyed by canonicalized SQL (via `sqlglot`). Cache invalidation tied to collection's `_metadata.parquet` build timestamp — stale entries purged when indexes are rebuilt. Schema responses cached indefinitely.
- **Collection-specific indexes:** Each collection defines tailored index structures to avoid brute-force scans (e.g., msnet has peptide index for fast sequence search)
- **Rate limiting:** Per-IP (10 req/min) and global concurrency cap (5 simultaneous queries) via `slowapi` or nginx
- **VM sizing:** Minimum 8 GB RAM. DuckDB `memory_limit` set to 60% of VM RAM. `temp_directory` on local SSD for spill-to-disk.

### 4. MCP Layer

**Remote MCP (on FastAPI VM, `/mcp` — Streamable HTTP transport):**

The same SQL pre-filter, rate limiting, and timeout enforcement applies to MCP tool handlers as to the REST endpoint. They are the same security domain.

| Tool | Description |
|------|-------------|
| `quantms_collections()` | List all collections with stats (reads registry.parquet) |
| `quantms_schema(collection, structure?)` | Get schema — columns, types, sample rows, partition info, hints |
| `quantms_query(sql, collection)` | Execute DuckDB SQL against collection (row limit, timeout, read-only) |

**Local MCP (`pip install quantms-mcp`):**

| Tool | Description |
|------|-------------|
| `quantms_collections()` | Same as remote (proxies to FastAPI) |
| `quantms_schema(collection, structure?)` | Same as remote (proxies to FastAPI) |
| `quantms_query(sql, collection)` | Same as remote (proxies to FastAPI) |
| `quantms_pull(collection, dataset?)` | Download QPX dataset from S3 to local filesystem |
| `quantms_query_local(path, sql)` | DuckDB query on locally downloaded QPX files (no row limits) |

**AI agent workflow example:**

```
Step 1: quantms_collections()
→ Sees "absolute-expression" with 45 datasets, protein index

Step 2: quantms_schema("absolute-expression", "absolute")
→ Learns columns: protein_accession, sample_id, ibaq, intensity...
→ Sees hint: "Join with sample on sample_id for tissue/condition info"

Step 3: quantms_query(
  collection="absolute-expression",
  sql="SELECT s.tissue, AVG(a.ibaq) as mean_ibaq, COUNT(DISTINCT d.project_accession) as n_datasets
       FROM absolute a JOIN sample s ON a.sample_id = s.sample_id
       JOIN dataset d ON s.project_accession = d.project_accession
       WHERE a.protein_accession = 'P04637'
       GROUP BY s.tissue ORDER BY mean_ibaq DESC"
)
→ Gets tissue-level TP53 expression in JSON

Step 4: Agent reasons over results, asks follow-up queries as needed.
```

## Two Data Layers: S3 Collection vs Web Collection

The system has two distinct data artifacts with a clear relationship:

**S3 Collection (source of truth):**
- Full QPX parquet datasets + heavy indexes (peptide, protein, DE, metadata)
- Lives on S3 in the standard qpx collection format (`_index/`, dataset subdirs)
- Used by: FastAPI backend (SQL queries, search), CLI (`qpx pull`), MCP (AI agents)
- Built first, independently of the web portal

**Web Collection (derived, for GitHub Pages):**
- Lightweight static JSON files derived FROM the S3 collection
- AI-generated descriptions, titles, tags
- Pre-computed statistics and plot data
- Paginated dataset listings, sample previews
- Lives in the portal git repo under `public/data/`
- Generated as a second step, pushed as a **reviewable PR**

```
S3 Collection (source of truth)          Web Collection (derived)
┌──────────────────────────────┐         ┌──────────────────────────────┐
│ s3://quantms-portal/         │         │ portal-repo/public/data/     │
│ └── collections/msnet/       │  ──→    │ └── collections/msnet/       │
│     ├── _index/              │ generate│     ├── collection.json      │
│     │   ├── peptide/ (400MB) │         │     ├── datasets-page-1.json │
│     │   ├── protein/ (50MB)  │         │     └── datasets/            │
│     │   └── metadata/        │         │         ├── PXD000865.json   │
│     ├── PXD000865/           │         │         └── PXD001234.json   │
│     │   ├── *.dataset.parquet│         │                              │
│     │   ├── *.sample.parquet │         │ + registry.json              │
│     │   ├── *.psm.parquet    │         │ + global-stats.json          │
│     │   └── ...              │         │ + .build-state.json          │
│     └── PXD001234/           │         └──────────────────────────────┘
│         └── ...              │
└──────────────────────────────┘         Total: ~5MB for 500 datasets
 Total: GBs (parquet data)               AI descriptions, plots, stats
 Indexes for search/SQL                   Reviewable via PR before deploy
```

**What stays on S3 only (never in web collection):**
- Raw PSM, feature, PG parquet data (too large)
- Heavy indexes for search (peptide: 400MB+, protein: 50MB+)
- Anything that needs DuckDB to query

**What goes into the web collection:**
- Collection summaries (title, description, stats, organisms, indexes available)
- Dataset listings (paginated, 50 per page)
- Dataset detail (metadata, sample preview capped at 20 rows, download commands)
- Global statistics (organisms, workflows, years — for charts)
- AI-generated descriptions and tags

### Workflow: S3 first, web second, PR to deploy

```
STEP 1: Build S3 collection (data engineering)
─────────────────────────────────────────────────
  qpx convert quantms PXD009876/ → QPX parquet files
  qpx publish msnet PXD009876/   → upload to S3
  qpx index build msnet --all    → rebuild peptide/protein/metadata indexes on S3
  
  Result: S3 collection is complete. Backend can serve queries immediately.
  This step can be automated in a pipeline (Nextflow → qpx convert → publish).

STEP 2: Generate web collection (content generation)
─────────────────────────────────────────────────
  qpx portal build-web \
    --from s3://quantms-portal/collections/ \
    --output ./portal-repo/public/data/ \
    --incremental \
    --pride-metadata \
    --ai

  What this does:
  - Reads ONLY lightweight parquets from S3 (dataset, sample, run — KBs each)
  - Fetches PRIDE metadata for titles/descriptions
  - Calls Claude API to generate collection descriptions and tags
  - Pre-computes statistics for charts
  - Writes static JSON files to local portal repo
  - Incremental: only processes new/changed datasets

STEP 3: Push as reviewable PR
─────────────────────────────────────────────────
  cd portal-repo
  git checkout -b update/msnet-add-PXD009876
  git add public/data/
  git commit -m "data: add PXD009876 to msnet collection"
  gh pr create --title "Add PXD009876 to msnet" --body "..."
  
  What gets reviewed:
  - AI-generated descriptions (are they accurate?)
  - Dataset metadata (correct organism, sample count?)
  - Statistics changes (do the numbers make sense?)
  
  On merge: GitHub Actions builds Vue app → deploys to GitHub Pages.
```

This separation gives you:
- **S3 collection available immediately** for backend/search/MCP (no PR needed)
- **Web collection reviewed before publication** (AI descriptions checked by human)
- **Decoupled timelines** — S3 data can be weeks ahead of the web portal
- **Rollback via git revert** if a web update has problems

## Static JSON Structure

The web collection is a set of JSON files committed to the portal git repo under `public/data/`.

### What goes static vs what stays on backend

| Data | Static JSON | Why |
|------|-------------|-----|
| Collection listing + stats | `registry.json` (~5KB) | Changes only when collections are added. Tiny. |
| Dataset table per collection | `collection.json` (~1-2KB per dataset) | Changes only when datasets are added. |
| Dataset detail (metadata, sample preview, download) | `PXD000865.json` (~5-10KB each) | Immutable once published. Capped preview. |
| Global statistics (charts) | `global-stats.json` (~10KB) | Pre-computed aggregations. |
| Peptide/protein search results | NOT static | Needs index scan across millions of rows. |
| Arbitrary SQL queries | NOT static | Dynamic, unpredictable. |
| MCP access | NOT static | Real-time query execution. |

**Size budget and GitHub limits:**

| Scale | Datasets | Data Size | Git History (50 updates) | Status |
|-------|----------|-----------|--------------------------|--------|
| Current | 57 | ~0.5 MB | ~25 MB | No issues |
| 1 year | 500 | ~5 MB | ~100 MB | No issues |
| 3 years | 5,000 | ~45 MB | ~500 MB | Consider CDN |
| 5 years | 20,000 | ~180 MB | needs separate data repo | Split data out |

GitHub Pages hard limits: 1 GB site size, 100 GB/month bandwidth, 10 builds/hour.

**The primary concern is git history bloat, not file size.** Regenerating all JSON files on every update creates diffs that accumulate. Mitigations (all built in from day 1):

1. **Incremental builds:** `qpx portal build-web --incremental` only regenerates JSONs for new/changed datasets. Tracks state via `.build-state.json` (accession → content hash). Full rebuild via `--force`.
2. **Dataset JSONs are immutable:** Once `PXD000865.json` is generated, it never changes (QPX data is immutable). Only `collection.json`, `registry.json`, and `global-stats.json` update.
3. **Paginated collection.json:** Datasets split into pages of 50 (`collection-page-1.json`, `collection-page-2.json`). The `collection.json` keeps only summary stats + page count. Avoids loading large JSON arrays in the browser.
4. **Configurable data URL base:** Vue app reads data from a configurable base (`/data/` by default, same origin). When scaling beyond 5,000 datasets, switch to `https://data.quantms.org/` (separate GitHub Pages site or S3+CloudFront) — a config change, not a code change.
5. **CDN:** If bandwidth exceeds 50 GB/month, put Cloudflare in front (free tier: unlimited bandwidth). Dataset JSONs are immutable, so browser caching is highly effective.

### Static JSON structure

```
public/data/
├── registry.json                              ← loaded by home page
│   {
│     "generated_at": "2026-04-09T12:00:00Z",
│     "collections": [
│       {
│         "name": "msnet",
│         "title": "MS-Net Peptide Identifications",
│         "description": "Large-scale peptide ID...",
│         "type": "identification",
│         "dataset_count": 12,
│         "organisms": ["Homo sapiens", "Mus musculus"],
│         "stats": {"total_psms": 45000000, "total_peptides": 890000, "total_proteins": 42000},
│         "indexes": ["peptide", "protein", "metadata"],
│         "has_search": true
│       }
│     ],
│     "global_stats": {
│       "total_datasets": 57,
│       "total_collections": 3,
│       "total_proteins": 42000,
│       "total_psms": 45000000
│     }
│   }
│
├── global-stats.json                          ← loaded by statistics page
│   {
│     "generated_at": "...",
│     "datasets_by_organism": {"Homo sapiens": 42, "Mus musculus": 10, ...},
│     "datasets_by_workflow": {"LFQ": 25, "TMT": 15, "DIA": 12},
│     "datasets_by_year": {"2024": 20, "2025": 30, "2026": 7},
│     "proteins_per_collection": {"msnet": 42000, "absolute-expression": 15000}
│   }
│
└── collections/
    ├── msnet/
    │   ├── collection.json                    ← summary only (no dataset list)
    │   │   {
    │   │     "name": "msnet",
    │   │     "title": "MS-Net Peptide Identifications",
    │   │     "description": "...",
    │   │     "generated_at": "...",
    │   │     "dataset_count": 12,
    │   │     "total_pages": 1,
    │   │     "datasets_per_page": 50,
    │   │     "stats": {"total_psms": 45000000, ...},
    │   │     "organisms": ["Homo sapiens", "Mus musculus"],
    │   │     "indexes": ["peptide", "protein"]
    │   │   }
    │   ├── datasets-page-1.json               ← paginated dataset listing (50/page)
    │   │   {
    │   │     "page": 1, "total_pages": 1,
    │   │     "datasets": [
    │   │       {
    │   │         "accession": "PXD000865",
    │   │         "title": "Human Proteome Map",
    │   │         "organism": "Homo sapiens",
    │   │         "samples": 12, "runs": 576,
    │   │         "structures": ["dataset","sample","run","psm","provenance"],
    │   │         "qpx_pull": "qpx pull msnet/PXD000865"
    │   │       }
    │   │     ]
    │   │   }
    │   └── datasets/
    │       └── PXD000865.json                 ← immutable per-dataset detail
    │           {
    │             "accession": "PXD000865",
    │             "collection": "msnet",
    │             "title": "Human Proteome Map — Multi-tissue",
    │             "description": "...",
    │             "generated_at": "...",
    │             "pride_url": "https://www.ebi.ac.uk/pride/archive/projects/PXD000865",
    │             "organisms": ["Homo sapiens"],
    │             "structures": ["dataset","sample","run","psm","provenance"],
    │             "partitioning": {"psm": ["organism", "run_file_name"]},
    │             "samples_preview": [
    │               {"sample_id": "S1", "organism": "Homo sapiens", "tissue": "Liver"},
    │               {"sample_id": "S2", "organism": "Homo sapiens", "tissue": "Brain"}
    │             ],
    │             "samples_total": 12,
    │             "runs_total": 576,
    │             "download": {
    │               "s3_url": "s3://quantms-portal/collections/msnet/PXD000865/",
    │               "qpx_command": "qpx pull msnet/PXD000865",
    │               "size_mb": 1240,
    │               "files": ["PXD000865.dataset.parquet", "PXD000865.sample.parquet", "..."]
    │             }
    │           }
```

### Static data generation command

`qpx portal build-web` reads QPX parquets from any source and writes static JSON for the portal.

**Sources:** The command supports reading from:
- **Local directory:** `qpx portal build-web ./collections/ --output ./public/data/`
- **S3:** `qpx portal build-web s3://quantms-portal/collections/ --output ./public/data/`
- **Mixed:** Some collections local, some on S3 — pass multiple paths.

**Incremental mode** (`--incremental`, default):
- Reads `.build-state.json` in the output directory — a map of `{accession: content_hash}`.
- For each dataset, computes a hash of `*.dataset.parquet` metadata (accession + modification time).
- Skips datasets whose hash matches the stored state — no JSON rewrite, no git diff.
- Always regenerates `collection.json`, `datasets-page-*.json`, `registry.json`, and `global-stats.json` (these are small and change on every update).
- Dataset JSONs (`PXD000865.json`) are immutable — once written, they never change. New datasets get new files; existing files are untouched.
- Full rebuild via `--force` to regenerate everything.

**Pagination** (built in from day 1):
- `collection.json` contains only summary stats, organism list, index list, and `total_pages` count — no dataset array.
- `datasets-page-N.json` files contain 50 datasets each. Vue loads pages on demand as user navigates the table.
- This avoids ever loading a multi-MB JSON in the browser, and keeps collection.json stable across updates (only page files change when datasets are added).

**What it reads (lightweight — metadata only):**
- `*.dataset.parquet` — project accession, title (1 row per dataset, tiny)
- `*.sample.parquet` — first 20 rows for preview, aggregated organisms/tissues
- `*.run.parquet` — count only, aggregated instruments
- `_index/metadata/metadata.parquet` — if available, uses pre-aggregated stats
- Does NOT read PSM, feature, or PG parquets (too large). Uses index metadata for counts.

**For S3 sources:** DuckDB reads only parquet metadata (footers) and small files via HTTP range requests. Reading a `*.sample.parquet` (typically <1MB) is fast even from S3. The generator never downloads full PSM data.

**PRIDE metadata enrichment:** For each dataset accession, optionally fetches title/description from the PRIDE REST API (`qpx.core.pride.fetch_pride_metadata()`). This adds human-readable context. Cached locally to avoid repeated API calls.

**AI-generated descriptions:** With `--ai` flag, sends collection metadata to Claude API to generate titles, descriptions, and tags. See Indexing & Publishing Pipeline section.

**Sample preview capping:** Each dataset's `samples_preview` is capped at 20 rows and limited to key columns only (sample_id, organism, tissue, disease, cell_line). This keeps per-dataset JSON files under 10KB.

### Release workflow

The release workflow has two independent paths:

```
PATH A: S3 Collection (immediate, no review needed)
──────────────────────────────────────────────────
1. qpx convert quantms PXD009876/ → QPX parquet files
2. qpx publish msnet PXD009876/   → upload to S3
3. qpx index build msnet --all    → rebuild indexes on S3
4. POST /api/v1/admin/reload      → backend picks up new data
   Result: backend can serve queries for PXD009876 immediately.

PATH B: Web Collection (reviewed PR, deploys to GitHub Pages)
──────────────────────────────────────────────────
5. qpx portal build-web \
     --from s3://quantms-portal/collections/ \
     --output ./portal-repo/public/data/ \
     --incremental --pride-metadata --ai
6. cd portal-repo
   git checkout -b update/msnet-add-PXD009876
   git add public/data/
   git commit -m "data: add PXD009876 to msnet collection"
7. gh pr create \
     --title "Add PXD009876 to msnet" \
     --body "AI-generated description, sample preview, stats update"
8. Review PR: check AI descriptions, metadata accuracy
9. Merge → GitHub Actions builds Vue → deploys to GitHub Pages
```

**What changes in the PR (1 new dataset):**
- `public/data/collections/msnet/datasets/PXD009876.json` — NEW file (~8KB)
- `public/data/collections/msnet/collection.json` — updated (dataset_count, stats)
- `public/data/collections/msnet/datasets-page-N.json` — updated (new entry on last page)
- `public/data/registry.json` — updated (collection stats)
- `public/data/global-stats.json` — updated (organism/workflow counts)
- `public/data/.build-state.json` — updated (new accession hash)
- All other dataset JSONs: **untouched** — clean diff, easy to review.

**Paths A and B are independent.** The S3 collection can be weeks ahead of the web portal. A dataset published to S3 is queryable via the backend/MCP immediately, but only appears on the website after the PR is merged. This is intentional — AI-generated descriptions need human review.

**Scaling strategy:**

| Scale | Action |
|-------|--------|
| 0 → 500 datasets | Everything in one repo. `public/data/` ~5MB. No issues. |
| 500 → 5,000 | Add Cloudflare CDN in front of GitHub Pages if bandwidth exceeds 50 GB/month. |
| 5,000 → 20,000 | Move `public/data/` to a separate `quantms-portal-data` repo. Vue app's `DATA_BASE_URL` env var points to `https://data.quantms.org/`. Config change only. |
| 20,000+ | Move static JSON to S3 + CloudFront. Same config change. |

## Indexing & Publishing Pipeline

The indexing pipeline is a set of `qpx` CLI commands that run as a batch process on your machine or in CI — not on the portal VM. These commands build the collection indexes, generate metadata, and publish to S3.

### qpx CLI commands (to be built)

| Command | Description |
|---------|-------------|
| `qpx index build <collection> <index>` | Scans all datasets in a collection directory, materializes partitioned index parquets into `_index/`. E.g., `qpx index build msnet peptide` scans all PSM parquets and builds the peptide index partitioned by first 2 AAs. |
| `qpx index build <collection> --all` | Rebuilds all indexes defined for the collection. |
| `qpx registry build <collections_root>` | Aggregates metadata across all collections into `registry.parquet`. Reads each collection's dataset/sample/run parquets to compute summary stats (dataset count, total PSMs, organisms, etc.). |
| `qpx publish <collection> <dataset>` | Uploads a QPX dataset to S3 under the collection prefix. Validates the dataset has required structures before upload. |
| `qpx publish <collection> --index` | Uploads rebuilt indexes to S3 using blue/green swap (writes to `_new/` prefix, finalizes by writing `_metadata.parquet` last). |
| `qpx collection describe <collection> --ai` | AI-generated metadata — calls an LLM API (Claude) to generate title, description, tags, and summary from the dataset metadata. See below. |

### AI-generated collection metadata

When publishing a new collection or adding datasets, AI can generate rich metadata automatically:

**What the AI generates:**
- Collection title and description (human-readable, for the portal)
- Dataset-level summaries (what the study is about, key findings context)
- Tags (organisms, tissues, diseases, workflows, instruments)
- Data quality notes (coverage, completeness warnings)

**How it works:**

```
qpx collection describe msnet --ai
```

1. Reads all `*.dataset.parquet`, `*.sample.parquet`, `*.run.parquet` in the collection
2. Extracts: organisms, tissues, instruments, sample counts, run counts, unique peptides/proteins
3. Fetches PRIDE project metadata via `qpx.core.pride.fetch_pride_metadata()` for each PXD accession (title, description, DOI, PubMed)
4. Sends structured context to Claude API:
   - "This collection contains N datasets from PRIDE: [PXD list with titles]. Organisms: [...]. Tissues: [...]. Total PSMs: N. Generate a collection title, description, and tags."
5. Writes the AI-generated metadata into the collection's `_index/metadata/` parquet (adds columns: `collection_title`, `collection_description`, `collection_tags`)
6. Optionally writes per-dataset descriptions into each `*.dataset.parquet`

**Two modes:**
- **CLI (`--ai` flag):** For batch/CI automation. Calls Claude API directly. Requires `ANTHROPIC_API_KEY`.
- **Interactive (MCP):** User tells Claude "describe this collection" via local MCP. Claude uses `quantms_query_local` to read the data and generates the metadata conversationally. User can review and edit before committing.

**Example AI output:**

```
Collection: msnet
Title: "MS-Net: Large-Scale Peptide Identification Atlas"
Description: "A comprehensive collection of peptide identifications across 12 public
proteomics datasets reanalyzed with the quantms pipeline. Covers 5 human tissues
(liver, spleen, testis, ovary, prostate) and mouse brain, totaling 45M PSMs and
890K unique peptides. Designed for peptide-level search and cross-study identification
comparison."
Tags: ["identification", "multi-tissue", "human", "mouse", "large-scale"]
```

### Index build pipeline (detailed)

**Peptide index build (`qpx index build msnet peptide`):**

```
1. Scan all datasets in collection: msnet/PXD*/
2. For each dataset, read PSM parquets (hive-partitioned)
3. Extract: sequence, peptidoform, charge_states, protein_accessions, score
4. Aggregate across datasets: GROUP BY sequence, peptidoform
   → per-peptide: project_accessions[], spectra_count, best_pep, charge_states[]
5. Partition by first 2 amino acids of sequence (~400 partitions)
6. Write to _index/peptide_new/{AA}/part-0.parquet (ZSTD compression)
7. Write _metadata.parquet last (build_time, datasets_included, total_entries, partition_count)
8. Atomic finalize: rename _index/peptide_new → _index/peptide
```

**Protein index build (`qpx index build msnet protein`):**

```
Same pattern but aggregates at protein level:
→ per-protein: anchor_protein, protein_accessions[], project_accessions[],
   gene_names[], global_qvalue, num_peptides, num_runs
Partitioned by first 2 chars of accession (~300 partitions)
```

**Metadata index build (automatic with any index build):**

```
Aggregates sample/run metadata across all datasets in collection:
→ per-dataset: project_accession, organism, tissue, instrument, n_samples, n_runs, psm_count
Written as single metadata.parquet (small, not partitioned)
```

### Where this runs

- **Local machine:** Developer runs `qpx index build` after converting new datasets
- **CI/CD:** GitHub Actions workflow triggered on new dataset PR — builds indexes, publishes to S3, triggers portal reload webhook
- **Never on the portal VM** — the portal only reads indexes, never builds them

## Data Flow

### Publishing a new dataset

```
quantms pipeline output → qpx convert → QPX parquet files
→ qpx publish collection/PXD... → S3 upload
→ qpx rebuild-index collection peptide → writes new index to _index/peptide_new/
→ qpx rebuild-index collection metadata → writes new metadata index
→ qpx finalize-index collection peptide → renames _new → live, writes _metadata.parquet last
→ qpx update-registry → regenerates registry.parquet
→ POST /api/v1/admin/reload-collection (webhook, secret-protected)
```

**Blue/green index reload (no downtime, no stale results):**
1. FastAPI receives reload webhook for collection X.
2. Loads new indexes into DuckDB under temporary names (e.g., `msnet_peptide_idx_new`).
3. In-flight queries continue using old tables.
4. Once new tables are fully loaded, atomically swaps the aliases (rename old → `_old`, new → live).
5. Drops old tables after a grace period (e.g., 60s for in-flight queries to complete).
6. Invalidates LRU cache entries for collection X.

**S3 write safety:** `qpx rebuild-index` writes to a `_new` prefix, then `qpx finalize-index` updates `_metadata.parquet` last. The portal only opens an index after `_metadata.parquet` is present, avoiding partial reads.

### Web user browsing

```
Browser → loads / → GET /api/v1/collections → renders collection cards
→ user clicks msnet → GET /api/v1/collections/msnet → dataset table
→ user clicks PXD000865 → POST /api/v1/query for sample/run data → detail page
→ user clicks Download → shows qpx pull command + S3 URLs
```

### AI agent querying

```
Agent → quantms_collections() → discovers collections
→ quantms_schema("msnet") → reads data model
→ quantms_query(sql="...", collection="msnet") → gets results as JSON
→ reasons, writes follow-up queries → iterates
```

### Bioinformatician downloading

```
qpx pull absolute-expression/PXD002004 → downloads QPX from S3
→ local DuckDB analysis via qpx query or Python API
```

## Collections Model

A collection is a group of QPX datasets under a common directory. Key properties:

- **One dataset belongs to exactly one collection** — no multi-membership
- **Directory convention** — no manifest file. Subdirectory with `*.dataset.parquet` = dataset
- **`_index/` prefix** — reserved for collection-level indexes
- **Each collection defines its own indexes** tailored to its use case
- **DatasetCollection class** (from qpx) handles cross-dataset DuckDB queries in virtual mode

### Initial collections

| Collection | Type | Content | Key Indexes |
|-----------|------|---------|-------------|
| msnet | identification | Large-scale peptide IDs across public datasets | peptide, protein, metadata |
| absolute-expression | quantification | iBAQ-based absolute protein expression across tissues | protein, metadata |
| differential-expression | quantification | Fold changes + p-values across conditions | de, metadata |

## Infrastructure & Operations

**VM requirements:**
- Minimum 8 GB RAM, 2+ vCPUs
- Local SSD for DuckDB spill-to-disk (`temp_directory`)
- systemd service with automatic restart on OOM kill
- `/health` endpoint wired to load balancer health check

**High availability (phased):**
- **Phase 1 (launch):** Single VM with systemd auto-restart. DuckDB state is lazily re-loaded from S3 on restart — recovery time ~60 seconds.
- **Phase 2 (when traffic justifies):** Active-passive pair behind ALB. Second VM warm-standby. Automatic failover via health check.

**HTTPS & CORS:**
- FastAPI VM must have proper TLS certificate (Let's Encrypt or AWS ACM behind ALB).
- CORS `allow_origins` set to exact production origins only: `["https://portal.quantms.org"]`. No wildcards. `http://localhost:5173` only in dev via environment variable.

**S3 bucket policy:**
- Block all public access (`s3:GetObject` requires authenticated requests).
- Enable S3 Block Public Access at both account and bucket level.
- IAM role for FastAPI VM scoped to `s3:GetObject` + `s3:ListBucket` on `s3://quantms-portal/` only.
- Download endpoint returns pre-signed URLs (time-limited), not raw S3 paths.
- Enable S3 access logging.

**Reverse proxy:**
- nginx or Cloudflare in front of the VM for IP-level rate limiting, connection flood absorption, and TLS termination.

**Monitoring:**
- Log all queries (SQL, collection, latency, rows returned, error/success) for debugging and abuse detection.
- Alert on: query timeout rate > 10%, memory usage > 80%, 5xx rate > 5%.

## Non-Goals (for this phase)

- Proteome Profiler (tissue heatmaps) — future service on top of absolute-expression collection
- PTM Explorer — future service on top of a PTM-specific collection
- Vector/semantic search — future enhancement
- User accounts / authentication — public data, no auth needed
- Real-time data ingestion — batch publishing via qpx CLI

## Technology Summary

| Component | Technology |
|-----------|-----------|
| Frontend | Vue 3 + Vite + Vue Router |
| Frontend hosting | GitHub Pages |
| Frontend styling | Custom CSS (Inter, JetBrains Mono, blue/indigo/violet palette) |
| Backend | FastAPI (Python) |
| Query engine | DuckDB (server-side) |
| Data format | QPX (parquet-based) |
| Data storage | AWS S3 |
| MCP remote | FastAPI SSE endpoint |
| MCP local | Python package (quantms-mcp) |
| CI/CD | GitHub Actions |
| Data publishing | qpx CLI |
