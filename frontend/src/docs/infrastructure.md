# Infrastructure

This page is a **mental model** of how the portal is built, not an operations
manual. The goal is to explain *why* the portal is fast and reliable, and how the
pieces fit together — so you can reason about what the portal can and cannot do.

<figure style="margin:30px 0 34px;">
<svg viewBox="0 0 1120 660" width="1120" height="660" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="sa-title sa-desc" style="width:100%;height:auto;max-width:1000px;display:block;margin:0 auto;color:var(--text-primary);">
  <title id="sa-title">quantms portal system architecture</title>
  <desc id="sa-desc">Three zones. Object storage (S3) is the immutable, content-addressed, versioned source of truth holding per-dataset dataset Parquet and index Parquet, a corpus prebuilt DuckDB database, and JSON summaries. A Kubernetes cluster runs two workloads: offline jobs, driven by a weekly CronJob, that index each dataset, assemble the corpus, enrich, build protein metadata, compute statistics and build the prebuilt database, writing all artifacts to S3 and then rolling the serving pods; and a stateless replicated pool of serving query pods that each open the prebuilt DuckDB and read the S3 artifacts in place, writing nothing, exposing REST and MCP. Clients are the web app over REST and AI agents over MCP.</desc>
  <style>
    .sa text { font-family: var(--font); }
    .sa .t-zone { font-size:13px; font-weight:700; fill:var(--text-primary); }
    .sa .t-badge { font-size:12px; font-weight:700; fill:#ffffff; }
    .sa .t-sub { font-size:10px; font-weight:600; fill:var(--text-secondary); }
    .sa .t-head { font-size:12px; font-weight:700; fill:var(--text-primary); }
    .sa .t-node { font-size:11px; font-weight:600; fill:var(--text-primary); }
    .sa .t-node-sm { font-size:9.5px; font-weight:500; fill:var(--text-secondary); }
    .sa .t-chip { font-size:9px; font-weight:600; fill:var(--text-primary); }
    .sa .t-muted { font-size:9.5px; font-weight:500; fill:var(--text-muted); }
    .sa .t-accent { font-size:11px; font-weight:700; fill:var(--indigo); }
    .sa .t-accent-sm { font-size:9.5px; font-weight:600; fill:var(--indigo); }
    .sa .t-flow { font-size:9px; font-weight:700; fill:var(--indigo); }
    .sa .t-flow-m { font-size:9px; font-weight:700; fill:var(--text-secondary); }
    .sa .panel { fill:var(--surface); stroke:var(--border); stroke-width:1; }
    .sa .subpanel { fill:var(--bg-alt); stroke:var(--border); stroke-width:1; }
    .sa .node { fill:var(--surface); stroke:var(--border); stroke-width:1; }
    .sa .chip { fill:var(--surface); stroke:var(--border); stroke-width:1; }
    .sa .accent { fill:rgba(99,102,241,0.10); stroke:var(--indigo); stroke-width:1.3; }
    .sa .badge { fill:var(--indigo); }
    .sa .down { stroke:var(--text-muted); stroke-width:1.4; fill:none; }
    .sa .flow { stroke:var(--indigo); stroke-width:2; fill:none; }
    .sa .flow-m { stroke:var(--text-secondary); stroke-width:1.8; fill:none; }
    .sa .ah-muted { fill:var(--text-secondary); }
    .sa .ah-accent { fill:var(--indigo); }
  </style>
  <defs>
    <marker id="sa-ahm" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto"><path class="ah-muted" d="M0,0 L5,2.5 L0,5 Z"/></marker>
    <marker id="sa-aha" markerWidth="8" markerHeight="8" refX="5.5" refY="3" orient="auto"><path class="ah-accent" d="M0,0 L6,3 L0,6 Z"/></marker>
  </defs>
  <g class="sa">
    <!-- ============ Zone panels ============ -->
    <rect class="panel" x="16" y="44" width="212" height="572" rx="12"/>
    <rect class="panel" x="252" y="44" width="576" height="572" rx="12"/>
    <rect class="panel" x="856" y="44" width="248" height="572" rx="12"/>
    <!-- ============ Zone C — Clients ============ -->
    <circle class="badge" cx="42" cy="68" r="11"/>
    <text class="t-badge" x="42" y="72" text-anchor="middle">C</text>
    <text class="t-zone" x="60" y="72">Clients</text>
    <text class="t-sub" x="32" y="92">web app · AI agents</text>
    <rect class="node" x="40" y="468" width="176" height="40" rx="8"/>
    <text class="t-node" x="128" y="486" text-anchor="middle">Web app</text>
    <text class="t-node-sm" x="128" y="500" text-anchor="middle">static single-page app</text>
    <rect class="accent" x="40" y="512" width="176" height="40" rx="8"/>
    <text class="t-accent" x="128" y="530" text-anchor="middle">AI agents</text>
    <text class="t-accent-sm" x="128" y="544" text-anchor="middle">MCP clients</text>
    <!-- Clients -> serving front doors -->
    <line class="flow-m" x1="217" y1="488" x2="279" y2="488" marker-end="url(#sa-ahm)"/>
    <text class="t-flow-m" x="248" y="480" text-anchor="middle">REST</text>
    <line class="flow" x1="217" y1="532" x2="279" y2="532" marker-end="url(#sa-aha)"/>
    <text class="t-flow" x="248" y="566" text-anchor="middle">MCP</text>
    <!-- ============ Zone B — Kubernetes cluster ============ -->
    <circle class="badge" cx="282" cy="68" r="11"/>
    <text class="t-badge" x="282" y="72" text-anchor="middle">B</text>
    <text class="t-zone" x="300" y="72">Kubernetes cluster</text>
    <text class="t-sub" x="300" y="90">offline jobs + serving pods</text>
    <!-- CronJob orchestrator -->
    <rect class="accent" x="268" y="104" width="170" height="48" rx="8"/>
    <text class="t-accent" x="353" y="124" text-anchor="middle">weekly CronJob</text>
    <text class="t-accent-sm" x="353" y="140" text-anchor="middle">orchestrates the pipeline</text>
    <line class="flow" x1="353" y1="152" x2="353" y2="168" marker-end="url(#sa-aha)"/>
    <text class="t-flow" x="404" y="165" text-anchor="middle">schedule</text>
    <!-- Offline jobs subpanel -->
    <rect class="subpanel" x="268" y="170" width="544" height="190" rx="10"/>
    <text class="t-head" x="282" y="196">Offline jobs — pipeline</text>
    <text class="t-node-sm" x="700" y="196" text-anchor="middle">reads raw inputs → writes artifacts</text>
    <!-- pipeline chips -->
    <rect class="chip" x="282" y="222" width="72" height="46" rx="6"/>
    <text class="t-chip" x="318" y="242" text-anchor="middle">Per-dataset</text>
    <text class="t-chip" x="318" y="254" text-anchor="middle">indexing</text>
    <line class="down" x1="355" y1="245" x2="369" y2="245" marker-end="url(#sa-ahm)"/>
    <rect class="chip" x="370" y="222" width="72" height="46" rx="6"/>
    <text class="t-chip" x="406" y="242" text-anchor="middle">Assemble</text>
    <text class="t-chip" x="406" y="254" text-anchor="middle">corpus</text>
    <line class="down" x1="443" y1="245" x2="457" y2="245" marker-end="url(#sa-ahm)"/>
    <rect class="chip" x="458" y="222" width="72" height="46" rx="6"/>
    <text class="t-chip" x="494" y="248" text-anchor="middle">Enrich</text>
    <line class="down" x1="531" y1="245" x2="545" y2="245" marker-end="url(#sa-ahm)"/>
    <rect class="chip" x="546" y="222" width="72" height="46" rx="6"/>
    <text class="t-chip" x="582" y="242" text-anchor="middle">Protein</text>
    <text class="t-chip" x="582" y="254" text-anchor="middle">metadata</text>
    <line class="down" x1="619" y1="245" x2="633" y2="245" marker-end="url(#sa-ahm)"/>
    <rect class="chip" x="634" y="222" width="72" height="46" rx="6"/>
    <text class="t-chip" x="670" y="248" text-anchor="middle">Statistics</text>
    <line class="down" x1="707" y1="245" x2="721" y2="245" marker-end="url(#sa-ahm)"/>
    <rect class="accent" x="722" y="222" width="72" height="46" rx="6"/>
    <text class="t-accent-sm" x="758" y="242" text-anchor="middle">Build</text>
    <text class="t-accent-sm" x="758" y="254" text-anchor="middle">prebuilt DB</text>
    <text class="t-muted" x="540" y="298" text-anchor="middle">idempotent · dependency-ordered · best-effort</text>
    <text class="t-muted" x="540" y="316" text-anchor="middle">one Parquet index per dataset · corpus built once</text>
    <!-- jobs -> serving pods rollout -->
    <line class="flow" x1="540" y1="360" x2="540" y2="402" marker-end="url(#sa-aha)"/>
    <text class="t-flow" x="612" y="386" text-anchor="middle">roll serving pods</text>
    <!-- Serving query pods subpanel -->
    <rect class="subpanel" x="268" y="404" width="544" height="200" rx="10"/>
    <text class="t-head" x="282" y="428">Serving query pods</text>
    <text class="t-node-sm" x="282" y="444">stateless · replicated pool · read-only</text>
    <!-- front doors -->
    <rect class="node" x="282" y="470" width="116" height="34" rx="7"/>
    <text class="t-node" x="340" y="491" text-anchor="middle">REST API</text>
    <rect class="accent" x="282" y="512" width="116" height="34" rx="7"/>
    <text class="t-accent" x="340" y="533" text-anchor="middle">MCP</text>
    <line class="down" x1="399" y1="491" x2="421" y2="497" marker-end="url(#sa-ahm)"/>
    <line class="down" x1="399" y1="529" x2="421" y2="520" marker-end="url(#sa-ahm)"/>
    <!-- replicated pod stack -->
    <rect class="node" x="440" y="466" width="150" height="46" rx="8"/>
    <rect class="node" x="432" y="474" width="150" height="46" rx="8"/>
    <rect class="accent" x="424" y="482" width="150" height="46" rx="8"/>
    <text class="t-accent" x="499" y="502" text-anchor="middle">Query pods</text>
    <text class="t-accent-sm" x="499" y="518" text-anchor="middle">stateless · ×N replicas</text>
    <line class="flow" x1="576" y1="505" x2="604" y2="505" marker-end="url(#sa-aha)"/>
    <!-- DuckDB engine block -->
    <rect class="accent" x="606" y="472" width="196" height="66" rx="8"/>
    <text class="t-accent" x="704" y="498" text-anchor="middle">Open prebuilt DuckDB</text>
    <text class="t-accent-sm" x="704" y="516" text-anchor="middle">read S3 in place · write nothing</text>
    <!-- ============ Zone A — Object storage (S3) ============ -->
    <circle class="badge" cx="882" cy="68" r="11"/>
    <text class="t-badge" x="882" y="72" text-anchor="middle">A</text>
    <text class="t-zone" x="900" y="72">Object storage (S3)</text>
    <text class="t-sub" x="900" y="90">the source of truth</text>
    <rect class="chip" x="884" y="118" width="192" height="46" rx="7"/>
    <text class="t-node" x="980" y="136" text-anchor="middle">Dataset Parquet</text>
    <text class="t-node-sm" x="980" y="152" text-anchor="middle">one per dataset</text>
    <rect class="chip" x="884" y="172" width="192" height="46" rx="7"/>
    <text class="t-node" x="980" y="190" text-anchor="middle">Index Parquet</text>
    <text class="t-node-sm" x="980" y="206" text-anchor="middle">one per dataset</text>
    <rect class="accent" x="884" y="226" width="192" height="50" rx="7"/>
    <text class="t-accent" x="980" y="246" text-anchor="middle">Prebuilt DuckDB database</text>
    <text class="t-accent-sm" x="980" y="262" text-anchor="middle">corpus · built once</text>
    <rect class="chip" x="884" y="286" width="192" height="76" rx="7"/>
    <text class="t-node" x="980" y="306" text-anchor="middle">JSON summaries</text>
    <text class="t-node-sm" x="980" y="326" text-anchor="middle">gene/name map · sequences</text>
    <text class="t-node-sm" x="980" y="344" text-anchor="middle">statistics · dataset metadata</text>
    <text class="t-muted" x="980" y="592" text-anchor="middle">immutable · content-addressed · versioned</text>
    <!-- ============ Cross-zone flows: cluster -> S3 ============ -->
    <line class="flow-m" x1="813" y1="250" x2="854" y2="250" marker-end="url(#sa-ahm)"/>
    <text class="t-flow-m" x="834" y="242" text-anchor="middle">write artifacts</text>
    <line class="flow" x1="804" y1="505" x2="854" y2="505" marker-end="url(#sa-aha)"/>
    <text class="t-flow" x="829" y="497" text-anchor="middle">read in place</text>
  </g>
</svg>
<figcaption style="text-align:center;font-size:12.5px;color:var(--text-muted);max-width:720px;margin:12px auto 0;line-height:1.55;">
System architecture and orchestration, for contributors. Immutable, content-addressed artifacts in <strong>object storage (S3)</strong> are the source of truth. Inside the <strong>Kubernetes cluster</strong>, a <strong>weekly CronJob</strong> drives the offline pipeline that rebuilds those artifacts and then rolls a stateless pool of <strong style="color:var(--indigo);">serving query pods</strong>; each pod opens the <strong style="color:var(--indigo);">prebuilt DuckDB</strong> and reads the S3 artifacts <strong style="color:var(--indigo);">in place</strong> — writing nothing — exposing REST for the web app and MCP for AI agents. Nothing at request time mutates shared state.
</figcaption>
</figure>

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
   summaries section on the [How search works](/docs/ps-how-search-works) page).
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
