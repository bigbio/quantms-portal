# Documentation IA Restructure — Plan (next docs version)

**Goal:** reorganize the portal docs from a flat 10-page list into an **application-oriented**
structure: general portal/data/concepts up front, then **one docs section per app**, with all
peptide-search-specific material (search mechanics, GPP evidence quality) living *under* the
Peptide & Protein Search app rather than at the portal top level.

**Status:** planning. No content moved yet. Decisions locked with the user 2026-07.

---

## 1. Why restructure

The current docs are a flat list in 3 groups (`frontend/src/docs/nav.js`):

- *Getting started*: introduction, infrastructure
- *Using the portal*: applications, how-search-works, evidence-quality, data, collections, download
- *Extend & contribute*: contribute, ai-mcp

Problem: **app-specific pages sit at the portal level.** `how-search-works` and `evidence-quality`
(GPP) are *only* about Peptide & Protein Search, yet they read as portal-wide concepts next to
genuinely general pages (`data`, `collections`). A reader can't tell what's portal-general vs
what belongs to one app, and there's nowhere for the *other* apps' docs to live. As the portal
grows (Dataset Search, Statistics, Baseline Expression, Models, …) this doesn't scale.

## 2. Target information architecture

Two levels the sidebar already supports (`group -> items`); we simply make **each app its own
group**. No nav.js schema change is required — only more groups + slug renames.

```
OVERVIEW (portal-general)
  • Introduction            what quantms portal is, who it's for, the ecosystem      [introduction]
  • Concepts                datasets · collections · apps — the core vocabulary       [concepts]  NEW
  • The data                what's indexed, gene-centric + content-addressed identity [data]
  • Infrastructure          static-first, immutable artifacts, stateless query pods   [infrastructure]

APPLICATIONS  (one group per app; landing index lists them all)
  • All applications        the app index (what each answers)                         [applications]
  ── Peptide & Protein Search ───────────────────────────────────────────────
  • Overview                what it does, how to use it                               [ps-overview]  NEW (from applications.md §Peptide)
  • How search works        mapping, counting, proteotypicity, coverage map, summaries[ps-how-search-works]  (was how-search-works)
  • Evidence quality (GPP)  the Global Peptide Probability score                      [ps-gpp]  (was evidence-quality)
  • API & MCP               peptide-search REST + MCP tools (gpp_min, profiles, …)    [ps-api]  NEW
  ── Dataset Search ─────────────────────────────────────────────────────────
  • Overview                browse/search datasets + open a dataset                   [ds-overview]  NEW (from applications.md §Dataset)
  ── Statistics ─────────────────────────────────────────────────────────────
  • Overview                corpus-wide numbers + proteome coverage                   [stats-overview]  NEW (from applications.md §Statistics)

DATA ACCESS & AI  (cross-cutting)
  • Download & CLI          browse, portal CLI, reuse                                 [download]
  • AI & MCP                the agent-ready model (per-app tools link into each app)   [ai-mcp]

EXTEND & CONTRIBUTE
  • Contribute              contributing data, code, docs                             [contribute]
```

Collections: it is both a **concept** (how datasets are grouped) and a **browse view**. Keep the
concept in `concepts` + the standalone `collections` page folds into OVERVIEW (or stays as a
concept page). It is NOT an "app" with its own search surface, so it does not get an app group.

## 3. Migration map (old → new)

| Current file | Action | New slug / home |
| --- | --- | --- |
| `introduction.md` | keep | `introduction` (Overview) |
| `infrastructure.md` | keep | `infrastructure` (Overview) |
| `data.md` | keep | `data` (Overview) |
| `collections.md` | fold into a new `concepts` page (or keep as a concept page) | `concepts` / `collections` |
| `applications.md` | **split**: keep as the app index; move each app's section into that app's `*-overview` | `applications` + `ps/ds/stats-overview` |
| `how-search-works.md` | move under Peptide Search | `ps-how-search-works` |
| `evidence-quality.md` | move under Peptide Search; retitle "Evidence quality (GPP)" | `ps-gpp` |
| `ai-mcp.md` | keep general; each app's tool list links from its API page | `ai-mcp` |
| `download.md` | keep | `download` |
| `contribute.md` | keep | `contribute` |
| — | **NEW** | `concepts` (datasets/collections/apps vocabulary) |
| — | **NEW** | `ps-overview`, `ds-overview`, `stats-overview` (from `applications.md`) |
| — | **NEW** | `ps-api` (peptide-search REST + MCP reference) |

Slug convention: **app-prefixed** (`ps-*`, `ds-*`, `stats-*`) so files sort by app and the URL
says which app (`/docs/ps-gpp`). Redirect old slugs (`evidence-quality`→`ps-gpp`,
`how-search-works`→`ps-how-search-works`) so existing links (and the app's in-UI "learn more"
links) don't 404.

## 4. Per-app docs template (repeatable for every app)

Each app group gets, in order:
1. **Overview** — what it answers, how to use it, link to open the app.
2. **How it works** — the app's mechanics (search: mapping/counting; stats: what's computed).
3. **App-specific concepts** — e.g. Peptide Search → Evidence quality (GPP). Optional.
4. **API & MCP** — the app's REST endpoints + MCP tools, with params (e.g. `gpp_min`).

This makes adding a new app's docs mechanical: new group + these 1-4 pages.

## 5. Content changes to fold in during the move

- **GPP page (`ps-gpp`)**: the current `evidence-quality.md` is already updated for the GPP rename
  and the dynamic 5%-FDR default. Retitle to "Evidence quality (GPP)". **Do NOT yet add** the
  per-peptidoform PEP-distribution (GPMDB NBS) section — per the user, that waits until the release
  that actually **wires `pep_shape` into the live score**; then this page gains a "PEP distribution
  (GPMDB NBS)" signal + a GPMDB reference, moved from planned to live. Track with `gpp-v2`.
- **`ps-api`**: document `gpp_min` (the new unified param) not the old `qc`/`qc_threshold`.
- **`applications.md`**: trim to a one-paragraph-per-app index that links into each app group.
- **`concepts`**: define dataset (content-addressed identity), collection, app, corpus — pulling the
  identity bits currently scattered in `data.md`/`collections.md` into one vocabulary page.

## 6. nav.js change (mechanical)

`DOCS_NAV` gains app groups; `DOCS_ORDER`/`DOCS_DEFAULT` derive as today. Sketch:

```js
export const DOCS_NAV = [
  { group: 'Overview', items: [
    { slug: 'introduction', title: 'Introduction' },
    { slug: 'concepts', title: 'Concepts' },
    { slug: 'data', title: 'The data' },
    { slug: 'infrastructure', title: 'Infrastructure' },
  ]},
  { group: 'Applications', items: [ { slug: 'applications', title: 'All applications' } ]},
  { group: 'Peptide & Protein Search', items: [
    { slug: 'ps-overview', title: 'Overview' },
    { slug: 'ps-how-search-works', title: 'How search works' },
    { slug: 'ps-gpp', title: 'Evidence quality (GPP)' },
    { slug: 'ps-api', title: 'API & MCP' },
  ]},
  { group: 'Dataset Search', items: [ { slug: 'ds-overview', title: 'Overview' } ]},
  { group: 'Statistics', items: [ { slug: 'stats-overview', title: 'Overview' } ]},
  { group: 'Data access & AI', items: [
    { slug: 'download', title: 'Download & CLI' },
    { slug: 'ai-mcp', title: 'AI & MCP' },
  ]},
  { group: 'Extend & contribute', items: [ { slug: 'contribute', title: 'Contribute' } ]},
]
```

Add a small slug-redirect map in the docs router so `evidence-quality`/`how-search-works` resolve
to the new slugs.

## 7. Execution phases (each shippable on its own)

1. **Nav + moves (no content rewrite):** rename `evidence-quality`→`ps-gpp`,
   `how-search-works`→`ps-how-search-works`; regroup nav.js; add redirects. Ship — the sidebar is
   already app-oriented with zero content risk.
2. **Split `applications.md`** into `ps-overview`/`ds-overview`/`stats-overview`; trim the index.
3. **New pages:** `concepts`, `ps-api` (from the live OpenAPI + MCP tool list).
4. **Fold-ins:** concepts vocabulary from data/collections; GPP page retitle.
5. **Later (gated on the pep_shape release):** add the PEP-distribution (GPMDB NBS) section to
   `ps-gpp` and flip it from planned to live.

## 8. Non-goals

- Not writing the actual new/rewritten prose in this plan (that's phases 2-4).
- Not building new apps' docs that don't exist yet (Baseline Expression, Models) — add their groups
  when their user-facing docs are written.
- Not changing the DocsPage/DocsLayout rendering beyond the slug-redirect map.
