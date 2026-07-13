# Infrastructure

This page is a **mental model** of how the portal is built, not an operations
manual. The goal is to explain *why* the portal is fast and reliable, and how the
pieces fit together — so you can reason about what the portal can and cannot do.

## Static-first by design

The portal separates **computation** from **serving**:

- **Offline jobs** do the heavy work — reading large proteomics results, reducing
  them to compact search indexes, computing statistics, and enriching datasets with
  metadata. These jobs run on a schedule, not when you click.
- **The results are immutable artifacts** — Parquet indexes, a prebuilt database,
  and JSON summaries — written once to object storage. Nothing about a request ever
  changes them.
- **The serving tier reads those artifacts** and answers queries.

Because the expensive computation happens ahead of time, the parts you interact
with stay small, quick and predictable.

## Immutable artifacts

Every artifact the portal serves is produced offline and treated as read-only:

- **Search index** — for each dataset, the large source tables are reduced to a
  compact table with one row per distinct peptidoform and protein group. One file
  per dataset means re-indexing a single dataset never touches the others, and the
  whole corpus is simply the collection of those files read together.
- **Prebuilt database** — the full index is materialized once into a single query
  database so that serving nodes can *open* it in seconds instead of rebuilding it.
- **JSON summaries** — dataset metadata, a shared gene/protein name map, protein
  sequences, and portal-wide statistics.

These artifacts are versioned and rebuilt on a regular schedule, so the served data
stays fresh without any request ever mutating shared state.

## A pool of small, stateless query services

The serving tier is a **pool of small, stateless services**. Each one:

- opens a read-only view of the immutable artifacts,
- runs queries with an embedded analytical engine (**DuckDB over Parquet**), and
- writes **nothing** back to shared storage.

Because no request mutates shared state, the services are interchangeable and
disposable: the portal can run more of them under load and fewer when idle, and any
one can be replaced at any time without coordination. There is no session state to
lose and no shared database to contend on.

## One query engine, two front doors

Each query service exposes the **same** query logic through two interfaces:

- a **REST API** that the web app calls, and
- an **MCP endpoint** that AI agents call.

Both are backed by identical query code, so a question answered in the web app and
the same question asked by an AI assistant return the same result. See
[AI & MCP](/docs/ai-mcp) for the agent-facing view.

## The web app is static

The web interface you are reading now is a **static single-page application**. It
ships as plain files, holds no server-side session, and simply calls the read-only
REST APIs for data. There is no application server rendering pages on demand — which
is what makes the portal cheap to host and resilient.

## Putting it together

1. **Offline jobs** produce immutable index, database, and JSON artifacts.
2. Those artifacts land in **object storage**, versioned and read-only.
3. A **pool of stateless query services** opens them and answers REST + MCP queries.
4. The **static web app** and **AI agents** consume those queries.

Nothing at request time changes shared state. That single property — read-only
serving over precomputed, immutable data — is the backbone of the portal's speed,
scalability and safety.

---

# Technical deep-dive

The rest of this page is for collaborators who want to understand *how* the portal
is built and *why* its queries are fast. Everything below is traceable to the
serving and indexing code; nothing here is required to use the portal.

## The databases and indexes we use

### DuckDB — the embedded analytical engine

The portal does not run a separate database server. Each query service embeds
**DuckDB**, an in-process analytical (columnar) engine, and runs it against
read-only artifacts. DuckDB is a good fit because the workload is analytical
(scan, filter, group, aggregate over a wide corpus of peptide observations) rather
than transactional, and because embedding it removes a whole tier of network hops,
connection pools and shared state. Queries run in-process, right next to the data.

### Per-dataset Parquet indexes

The raw inputs are large: a single dataset's identification results can be
hundreds of megabytes of PSM- or msstats-level rows. Serving those directly would
be slow and wasteful, because a search only ever cares about *distinct*
observations. So each dataset is reduced offline to a compact **Parquet index**
with **one row per distinct (peptidoform, protein group)**. The reducer streams the
source row-by-row and keeps only the distinct map in memory, so a multi-hundred-MB
input collapses to a few megabytes regardless of source size. Each row carries the
bare peptide, the peptidoform, its modifications and site strings, the protein
accessions and names it maps to, the observed charges, an observation-count proxy,
and a little faceting metadata (organism, tissue, disease, instrument).

One Parquet file **per dataset** is deliberate: the full corpus is simply the
collection of those files read together, and re-indexing a single dataset never
rewrites the others. It is an append-only body of small files.

### The prebuilt DuckDB database

Reading the whole Parquet corpus and materializing it into a query table is
expensive — it takes on the order of ten to fifteen minutes for tens of millions of
rows. Doing that inside every serving node on every startup was the original
hot-path cost. Instead, an offline job materializes the corpus **once** into a
single prebuilt DuckDB database and treats it as an immutable artifact. Serving
nodes then **open** that file in seconds instead of rebuilding it. The prebuilt
database is produced by the exact same build path a node would run itself, so it is
faithful to what a node would have built — plus the precomputed caches described
below.

A build-version sentinel guards compatibility: a node accepts the prebuilt database
only when its version and recorded row count match what the code expects, and
otherwise falls back to materializing from Parquet (slower, but always correct).
That fallback is why a missing or stale prebuilt database degrades performance
without ever serving wrong data.

### In-database indexes: ART and the `prot_tokens` inverted index

Inside the query table, two kinds of secondary index turn scans into lookups:

- **ART (Adaptive Radix Tree) indexes** on the hot scalar columns — bare peptide,
  peptidoform, organism, collection, dataset reference, instrument, peptide length,
  and similar. An exact peptide lookup becomes an index probe instead of a full
  scan of the corpus. (List-valued columns such as the protein-accession lists
  can't be ART-indexed and are handled by the inverted index below.)
- **`prot_tokens` — an inverted index for protein and gene lookup.** Protein
  identifiers and names live in list columns, which are awkward to index directly.
  So the build derives a narrow, ART-indexed side table with one lowercased row per
  protein accession and per protein name, linked back to its source row by a stable
  row id. A protein or gene search probes this small indexed table instead of
  scanning every row's list columns, and an exact-accession match becomes a plain
  equality lookup. If this token table can't be built, protein search falls back to
  a slower list scan — correct, just not as quick.

### Small in-memory caches built at materialization

When a node materializes or opens the database, it also builds a handful of tiny
in-memory structures so the most common answers never touch the main table:

- the corpus-level **statistics** numbers,
- the **facet** values used to populate filters,
- the **modification vocabulary** and the set of valid `(name, residue)` pairs,
- a **gene / name / accession resolver** — exact-match maps from an accession, a
  gene symbol or a protein name to the identifiers they refer to, so protein
  resolution never scans the table per request,
- a small **accession → gene** map backing gene-level counting, and
- observation-level cutoffs used for normalization.

Each of these exists because it removes work from the request path: they are
computed once, at build/open time, and read straight from memory thereafter. In the
prebuilt database these caches are persisted alongside the data so an opening node
loads them directly rather than recomputing them.

## How the indexes are created (the offline jobs)

The artifacts above are produced by a pipeline of offline **jobs**, run in
dependency order. Each job is idempotent and best-effort: a bad source is recorded
and skipped, never crashing the run, so one broken dataset can't poison the corpus.
Described by role, not deployment:

1. **Per-dataset indexing** — reduces each dataset's large PSM / msstats results to
   its compact Parquet index (one row per distinct peptidoform + protein group).
2. **All-datasets assembly** — runs the per-dataset step across every collection so
   the whole corpus of index files is present and current.
3. **Enrichment** — generates the human-readable dataset summaries (see the LLM
   summaries section on the [How search works](/docs/how-search-works) page).
4. **Protein metadata** — builds the shared gene / protein-name map and the
   canonical protein sequences used by resolution and the coverage map.
5. **Statistics** — computes the portal-wide numbers (dataset / peptide /
   peptidoform / protein counts, per-organism proteome coverage, modification
   distributions) as a static JSON summary.
6. **Build database** — materializes the refreshed corpus into the single prebuilt
   DuckDB database once, including the persisted meta caches, so serving nodes can
   open it in seconds.

A **weekly refresh** reruns this pipeline on a schedule so served data never goes
stale, and then rolls the serving nodes so they pick up the freshly built database.
Because every step is idempotent, a failure in any one job simply leaves the
previous good artifact in place until the next run.

## Why queries are fast

The speed is a consequence of the design above, not of any single trick:

- **The prebuilt database is opened, not rebuilt.** Nodes skip the ten-to-fifteen
  minute materialization and are ready in seconds — so there is no per-request build
  cost, ever.
- **Lookups, not scans.** ART indexes and the `prot_tokens` inverted index turn
  exact peptide and protein/gene queries into index probes instead of full scans of
  a tens-of-millions-of-rows corpus.
- **Common answers come from memory.** Statistics, facets and the modification
  vocabulary are served from the small in-memory caches, so they don't touch the
  main table at all.
- **Every query is bounded to matching rows.** Even the heavier computations
  (proteotypicity, coverage) operate only on the rows for the queried
  peptide/protein, never over the whole corpus — the work scales with the answer,
  not with the size of the portal.

### Representative latencies

The numbers below are **approximate, representative** timings from a remote client,
so they **include network round-trip** — server-side work is lower. They are a feel
for the shape of the system, not a benchmark guarantee.

| Query | Approx. latency | Why |
| --- | --- | --- |
| Statistics / facets / modification vocabulary | ~40–60 ms | Served from in-memory caches |
| Exact peptide search | ~55–60 ms | Index lookup |
| Protein profile | ~55–60 ms | Index lookup |
| Protein sequence coverage map | ~1.0 s | Per-residue computation over the canonical sequence |
| Gene / protein search | ~1.2 s | Heavier per-query resolution and aggregation |

The pattern is the point: exact lookups and cached answers are tens of
milliseconds; the two endpoints that do real per-query computation (mapping every
observed peptide onto a sequence, or resolving and aggregating a gene across the
corpus) are around a second. Nothing scales with the total size of the portal.
