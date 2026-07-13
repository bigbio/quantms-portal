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
