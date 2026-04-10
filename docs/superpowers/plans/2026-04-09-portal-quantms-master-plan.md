# portal.quantms.org — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-first proteomics data portal with QPX datasets on S3, a FastAPI query service, Vue 3 frontend, and MCP access layer.

**Architecture:** S3 for data storage (parquet collections), FastAPI+DuckDB on a small VM for SQL queries and MCP, Vue 3 SPA on GitHub Pages. Everything is parquet, everything is queryable via SQL.

**Tech Stack:** Python (FastAPI, DuckDB, Click, pyarrow), Vue 3 (Vite, Vue Router), MCP (Streamable HTTP), AWS S3

**Spec:** `docs/superpowers/specs/2026-04-09-portal-quantms-design.md`

---

## Sub-Projects (in dependency order)

| # | Sub-Project | Repo | Depends On | Plan |
|---|------------|------|------------|------|
| 1 | **qpx Indexing + Static Data** | quantms.io | — | `2026-04-09-plan-1-qpx-indexing.md` |
| 2 | **Vue Web App** | quantms-portal | Plan 1 | `2026-04-09-plan-2-vue-webapp.md` |
| 3 | **FastAPI Portal Backend** | quantms-portal | Plan 1 | `2026-04-09-plan-3-fastapi-backend.md` |
| 4 | **MCP Packages** | quantms-portal + quantms-mcp | Plan 3 | `2026-04-09-plan-4-mcp-packages.md` |

Each plan produces working, testable software independently.

## Implementation Phases

```
PHASE 1: STATIC PORTAL (shippable MVP, zero infrastructure cost)
─────────────────────────────────────────────────────────────────
Plan 1: qpx indexing + static JSON generator
    → build indexes for msnet_qpx, absexpr_qpx
    → generate static JSON portal data
    ↓
Plan 2: Vue web app (reads static JSON only)
    → deploy to GitHub Pages
    → Portal is LIVE and browsable. No backend needed.

PHASE 2: BACKEND ENHANCEMENT (search, SQL, AI access)
─────────────────────────────────────────────────────────────────
Plan 3: FastAPI backend (SQL queries, search, DuckDB)
    → portal gains search and SQL query capabilities
    → graceful degradation: if backend is down, Tier 1 still works
    ↓
Plan 4: MCP packages (remote + local)
    → AI agents can query the portal
    → local MCP for offline analysis
```

**Key property:** Phase 1 produces a fully working portal hosted entirely on GitHub Pages. Phase 2 can be built at any time without breaking the existing portal.
