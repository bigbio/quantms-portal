# AI & MCP

The portal is **AI-native**: everything a person can do in the web apps, an AI
agent can do too. Both go through the same query engine over the same immutable
data (see [Infrastructure](/docs/infrastructure)), so a person and an assistant
asking the same question get the same answer.

<figure style="margin:30px 0 32px;">
<svg viewBox="0 0 900 280" width="900" height="280" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="qp-mcp-title qp-mcp-desc" style="width:100%;height:auto;max-width:820px;display:block;margin:0 auto;color:var(--text-primary);">
  <title id="qp-mcp-title">One query engine, two front doors</title>
  <desc id="qp-mcp-desc">A single query engine in the middle. On the left, a REST API serves the web app for people. On the right, an MCP endpoint lets an AI agent call the same tools, here chaining a protein search into a coverage-map lookup.</desc>
  <style>
    .qm text { font-family: var(--font); }
    .qm .t-node { font-size:13px; font-weight:700; fill:var(--text-primary); }
    .qm .t-sm { font-size:11px; font-weight:500; fill:var(--text-secondary); }
    .qm .t-muted { font-size:10.5px; font-weight:500; fill:var(--text-muted); }
    .qm .t-lbl { font-size:10px; font-weight:700; fill:var(--text-muted); letter-spacing:.06em; }
    .qm .t-accent { font-size:13px; font-weight:700; fill:var(--indigo); }
    .qm .t-albl { font-size:10.5px; font-weight:700; fill:var(--indigo); letter-spacing:.06em; }
    .qm .t-tool { font-size:10.5px; font-weight:600; fill:var(--text-primary); }
    .qm .node { fill:var(--surface); stroke:var(--border); stroke-width:1; }
    .qm .engine { fill:var(--bg-alt); stroke:var(--indigo); stroke-width:1.4; }
    .qm .accent { fill:rgba(99,102,241,0.08); stroke:var(--indigo); stroke-width:1.3; }
    .qm .tool { fill:var(--surface); stroke:var(--border); stroke-width:1; }
    .qm .conn { stroke:var(--text-muted); stroke-width:1.6; fill:none; }
    .qm .aconn { stroke:var(--indigo); stroke-width:2; fill:none; }
    .qm .ah-m { fill:var(--text-muted); }
    .qm .ah-a { fill:var(--indigo); }
  </style>
  <defs>
    <marker id="qm-ahm" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto"><path class="ah-m" d="M0,0 L5,2.5 L0,5 Z"/></marker>
    <marker id="qm-aha" markerWidth="8" markerHeight="8" refX="5.5" refY="3" orient="auto"><path class="ah-a" d="M0,0 L6,3 L0,6 Z"/></marker>
  </defs>
  <g class="qm">
    <!-- Engine (center) -->
    <rect class="engine" x="360" y="108" width="180" height="64" rx="12"/>
    <text class="t-node" x="450" y="136" text-anchor="middle">Query engine</text>
    <text class="t-sm" x="450" y="154" text-anchor="middle">DuckDB over S3 artifacts</text>
    <!-- Left: REST -> Web app (for people) -->
    <rect class="node" x="40" y="112" width="160" height="56" rx="10"/>
    <text class="t-node" x="120" y="136" text-anchor="middle">Web app</text>
    <text class="t-sm" x="120" y="154" text-anchor="middle">for people</text>
    <line class="conn" x1="360" y1="140" x2="206" y2="140" marker-end="url(#qm-ahm)"/>
    <text class="t-lbl" x="283" y="130" text-anchor="middle">REST API</text>
    <!-- Right: MCP -> AI agent (agentic) -->
    <line class="aconn" x1="540" y1="140" x2="694" y2="140" marker-end="url(#qm-aha)"/>
    <text class="t-albl" x="617" y="130" text-anchor="middle">MCP</text>
    <rect class="accent" x="700" y="86" width="170" height="108" rx="12"/>
    <text class="t-accent" x="785" y="108" text-anchor="middle">AI agent</text>
    <rect class="tool" x="712" y="120" width="146" height="26" rx="6"/>
    <text class="t-tool" x="785" y="137" text-anchor="middle">1 · search protein</text>
    <line class="aconn" x1="785" y1="146" x2="785" y2="156" marker-end="url(#qm-aha)"/>
    <rect class="tool" x="712" y="158" width="146" height="26" rx="6"/>
    <text class="t-tool" x="785" y="175" text-anchor="middle">2 · coverage map</text>
    <!-- Captions under each door -->
    <text class="t-muted" x="120" y="196" text-anchor="middle">people</text>
    <text class="t-muted" x="450" y="196" text-anchor="middle">one engine · same tools</text>
    <text class="t-muted" x="785" y="212" text-anchor="middle">agentic apps</text>
  </g>
</svg>
<figcaption style="text-align:center;font-size:12.5px;color:var(--text-muted);max-width:600px;margin:10px auto 0;line-height:1.55;">
One query engine, two front doors: a REST API answers the <strong>web app</strong> for people, while an <strong style="color:var(--indigo);">MCP endpoint</strong> lets an AI agent call the same tools — here chaining a protein search into a coverage-map lookup — over the same immutable data.
</figcaption>
</figure>

## The same data, agent-ready

Alongside the REST API that powers the web app, each query service exposes an
endpoint that speaks the **Model Context Protocol (MCP)** — an open standard for
connecting AI assistants to tools and data. An MCP-capable assistant (such as
Claude) can connect to the portal and call its tools directly, then reason over the
structured results.

Because the MCP tools wrap the *exact same* queries as the apps, agents inherit the
portal's biology for free — gene-centric protein identity, residue-resolved
coverage, and the biological-versus-artifact classification of modifications.

## What agents can do

The MCP tools mirror the [applications](/docs/applications):

**Peptide & protein search**

- **Search peptides** — find datasets containing a sequence, with modification and
  metadata filters.
- **Search proteins** — find datasets containing a protein by accession or
  gene/protein name, resolved gene-centrically.
- **Peptide profile** — where a peptide is observed, its proteotypicity, mapped
  proteins and site-resolved modifications.
- **Protein profile** — gene/name, coverage, peptide counts, modifications and the
  datasets a protein appears in.
- **Protein coverage map** — the per-residue observation depth, normalized
  intensity, and modification sites along a protein's canonical sequence.
- **List modifications** — the modification vocabulary with biological-versus-
  artifact classification.
- **List facets and stats** — available filter values and index-size numbers.

**Dataset search**

- **List collections**, **search datasets**, **get a dataset**, and **list facets**
  across the catalog.

## Why it matters

An assistant can chain these tools to answer questions no single page does — for
example, take a protein, pull its coverage map, identify the most-modified
residues, and then find which datasets observed those modifications — all over the
same standardized corpus you browse in the web app.

To try the equivalent queries yourself, start from
[Peptide & Protein Search](/apps/peptide-search) or
[Dataset Search](/apps/dataset-search).
