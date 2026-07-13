# Introduction

The **quantms data portal** is an open, static-first data portal for quantitative
proteomics. It indexes and serves proteomics results produced by the quantms
ecosystem and layers biological search and analytics on top — so you can go from
"which datasets contain this peptide?" to a residue-level view of a protein in a
few clicks.

Everything the portal serves is derived from **standardized, reproducible
reanalyses**: raw public proteomics data reprocessed with the quantms workflow
into a consistent quantitative format, then indexed for search. Because every
dataset is processed the same way, results are directly comparable across studies,
organisms, tissues and instruments.

<figure style="margin:32px 0 34px;">
<svg viewBox="0 0 1000 360" role="img" aria-labelledby="qp-flow-title qp-flow-desc" style="width:100%;height:auto;max-width:920px;display:block;margin:0 auto;color:var(--text-primary);">
  <title id="qp-flow-title">How the quantms portal works</title>
  <desc id="qp-flow-desc">A four-stage flow: Contribute reprocesses public mass-spectrometry data with the quantms workflow into QPX and publishes it with a GitHub-authenticated CLI; Store keeps immutable, content-addressed artifacts in object storage; Query runs a pool of stateless services with DuckDB directly over those artifacts; Serve exposes one engine through a REST API for the web app and an MCP endpoint for AI agents.</desc>
  <style>
    .qp text { font-family: var(--font); }
    .qp .t-title { font-size:15px; font-weight:700; fill:var(--text-primary); }
    .qp .t-badge { font-size:12px; font-weight:700; fill:#ffffff; }
    .qp .t-sub { font-size:10.5px; font-weight:600; fill:var(--text-secondary); }
    .qp .t-kick { font-size:9.5px; font-weight:700; fill:var(--text-muted); letter-spacing:.08em; }
    .qp .t-node { font-size:12px; font-weight:600; fill:var(--text-primary); }
    .qp .t-node-sm { font-size:10.5px; font-weight:500; fill:var(--text-secondary); }
    .qp .t-muted { font-size:10px; font-weight:500; fill:var(--text-muted); }
    .qp .t-accent { font-size:12px; font-weight:700; fill:var(--indigo); }
    .qp .t-accent-sm { font-size:10.5px; font-weight:600; fill:var(--indigo); }
    .qp .t-qpx { font-size:16px; font-weight:800; fill:var(--indigo); letter-spacing:.04em; }
    .qp .panel { fill:var(--surface); stroke:var(--border); stroke-width:1; }
    .qp .subpanel { fill:var(--bg-alt); stroke:var(--border); stroke-width:1; }
    .qp .node { fill:var(--surface); stroke:var(--border); stroke-width:1; }
    .qp .chip { fill:var(--surface); stroke:var(--border); stroke-width:1; }
    .qp .accent { fill:rgba(99,102,241,0.10); stroke:var(--indigo); stroke-width:1.3; }
    .qp .badge { fill:var(--indigo); }
    .qp .down { stroke:var(--text-muted); stroke-width:1.4; fill:none; }
    .qp .flow { stroke:var(--indigo); stroke-width:2; fill:none; }
    .qp .ah-muted { fill:var(--text-muted); }
    .qp .ah-accent { fill:var(--indigo); }
  </style>
  <defs>
    <marker id="qp-ahm" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto"><path class="ah-muted" d="M0,0 L5,2.5 L0,5 Z"/></marker>
    <marker id="qp-aha" markerWidth="8" markerHeight="8" refX="5.5" refY="3" orient="auto"><path class="ah-accent" d="M0,0 L6,3 L0,6 Z"/></marker>
  </defs>
  <g class="qp">
    <!-- Panels -->
    <rect class="panel" x="12" y="24" width="223" height="316" rx="12"/>
    <rect class="panel" x="263" y="24" width="223" height="316" rx="12"/>
    <rect class="panel" x="514" y="24" width="223" height="316" rx="12"/>
    <rect class="panel" x="765" y="24" width="223" height="316" rx="12"/>

    <!-- Inter-panel flow arrows -->
    <line class="flow" x1="239" y1="182" x2="257" y2="182" marker-end="url(#qp-aha)"/>
    <line class="flow" x1="490" y1="182" x2="508" y2="182" marker-end="url(#qp-aha)"/>
    <line class="flow" x1="741" y1="182" x2="759" y2="182" marker-end="url(#qp-aha)"/>

    <!-- Stage 1: Contribute -->
    <circle class="badge" cx="42" cy="46" r="11"/>
    <text class="t-badge" x="42" y="50" text-anchor="middle">1</text>
    <text class="t-title" x="60" y="50">Contribute</text>
    <text class="t-sub" x="28" y="74">Reprocess, standardize, publish</text>
    <rect class="node" x="28" y="88" width="191" height="38" rx="8"/>
    <text class="t-node" x="123.5" y="112" text-anchor="middle">Public MS studies &amp; raw data</text>
    <line class="down" x1="123.5" y1="126" x2="123.5" y2="140" marker-end="url(#qp-ahm)"/>
    <rect class="node" x="28" y="142" width="191" height="40" rx="8"/>
    <text class="t-node" x="123.5" y="162" text-anchor="middle">quantms workflow</text>
    <text class="t-node-sm" x="123.5" y="176" text-anchor="middle">reprocessing</text>
    <line class="down" x1="123.5" y1="182" x2="123.5" y2="196" marker-end="url(#qp-ahm)"/>
    <rect class="accent" x="28" y="198" width="191" height="46" rx="8"/>
    <text class="t-qpx" x="123.5" y="220" text-anchor="middle">QPX</text>
    <text class="t-accent-sm" x="123.5" y="236" text-anchor="middle">the common standard</text>
    <line class="down" x1="123.5" y1="244" x2="123.5" y2="258" marker-end="url(#qp-ahm)"/>
    <rect class="node" x="28" y="260" width="191" height="46" rx="8"/>
    <text class="t-node" x="123.5" y="280" text-anchor="middle">Publish · quantms-portal CLI</text>
    <text class="t-muted" x="123.5" y="295" text-anchor="middle">GitHub-authenticated</text>

    <!-- Stage 2: Store -->
    <circle class="badge" cx="293" cy="46" r="11"/>
    <text class="t-badge" x="293" y="50" text-anchor="middle">2</text>
    <text class="t-title" x="311" y="50">Store</text>
    <text class="t-sub" x="279" y="74">Immutable, content-addressed</text>
    <rect class="subpanel" x="279" y="88" width="191" height="192" rx="10"/>
    <text class="t-kick" x="374.5" y="106" text-anchor="middle">OBJECT STORAGE (S3)</text>
    <rect class="chip" x="291" y="116" width="167" height="38" rx="6"/>
    <text class="t-node" x="374.5" y="139" text-anchor="middle">Parquet indexes</text>
    <rect class="chip" x="291" y="162" width="167" height="38" rx="6"/>
    <text class="t-node" x="374.5" y="185" text-anchor="middle">Prebuilt DuckDB database</text>
    <rect class="chip" x="291" y="208" width="167" height="38" rx="6"/>
    <text class="t-node" x="374.5" y="231" text-anchor="middle">JSON summaries</text>
    <text class="t-muted" x="374.5" y="300" text-anchor="middle">Built offline · read-only ·</text>
    <text class="t-muted" x="374.5" y="314" text-anchor="middle">one canonical entry per dataset</text>

    <!-- Stage 3: Query -->
    <circle class="badge" cx="544" cy="46" r="11"/>
    <text class="t-badge" x="544" y="50" text-anchor="middle">3</text>
    <text class="t-title" x="562" y="50">Query</text>
    <text class="t-sub" x="530" y="74">Query the data in place</text>
    <rect class="node" x="546" y="100" width="175" height="36" rx="8"/>
    <rect class="node" x="538" y="94" width="175" height="36" rx="8"/>
    <rect class="node" x="530" y="88" width="175" height="36" rx="8"/>
    <text class="t-node" x="617.5" y="110" text-anchor="middle">Stateless query services</text>
    <line class="down" x1="617.5" y1="124" x2="617.5" y2="148" marker-end="url(#qp-ahm)"/>
    <rect class="accent" x="530" y="150" width="191" height="54" rx="8"/>
    <text class="t-accent" x="625.5" y="172" text-anchor="middle">DuckDB over the S3 artifacts</text>
    <text class="t-accent-sm" x="625.5" y="189" text-anchor="middle">reads in place · writes nothing</text>
    <text class="t-muted" x="625.5" y="228" text-anchor="middle">Pool of pods · scales horizontally</text>

    <!-- Stage 4: Serve -->
    <circle class="badge" cx="795" cy="46" r="11"/>
    <text class="t-badge" x="795" y="50" text-anchor="middle">4</text>
    <text class="t-title" x="813" y="50">Serve</text>
    <text class="t-sub" x="781" y="74">Two front doors, one engine</text>
    <rect class="node" x="781" y="88" width="191" height="38" rx="8"/>
    <text class="t-node" x="876.5" y="112" text-anchor="middle">One query engine</text>
    <line class="down" x1="876.5" y1="126" x2="876.5" y2="150" marker-end="url(#qp-ahm)"/>
    <rect class="node" x="781" y="152" width="191" height="46" rx="8"/>
    <text class="t-node" x="876.5" y="172" text-anchor="middle">REST API → Web app</text>
    <text class="t-node-sm" x="876.5" y="187" text-anchor="middle">for people</text>
    <line class="flow" x1="876.5" y1="198" x2="876.5" y2="222" marker-end="url(#qp-aha)"/>
    <rect class="accent" x="781" y="224" width="191" height="52" rx="8"/>
    <text class="t-accent" x="876.5" y="246" text-anchor="middle">MCP → AI agents</text>
    <text class="t-accent-sm" x="876.5" y="263" text-anchor="middle">agentic apps · same tools</text>
    <text class="t-muted" x="876.5" y="300" text-anchor="middle">Same engine · same answers</text>
  </g>
</svg>
<figcaption style="text-align:center;font-size:12.5px;color:var(--text-muted);max-width:660px;margin:10px auto 0;line-height:1.55;">
How the portal works end to end. Contributors reprocess public MS data with the quantms workflow into <strong style="color:var(--indigo);">QPX</strong>, the common standard, and publish it with a GitHub-authenticated CLI. Results are stored as immutable, content-addressed artifacts in object storage. A pool of stateless services then <strong style="color:var(--indigo);">queries that data in place on S3</strong>, and one engine serves it through a REST API for the web app and an <strong style="color:var(--indigo);">MCP endpoint for AI agents</strong>.
</figcaption>
</figure>

## What you can do here

- **Search peptides and proteins** across every indexed dataset — find where a
  sequence has been observed, inspect protein sequence coverage and intensity, and
  explore post-translational modifications.
- **Search and browse datasets** and the curated collections that group them.
- **Read corpus-level statistics** — proteome coverage, species, tissues,
  instruments and modification distributions across the whole portal.
- **Download** standardized results for your own analysis, through the browse
  interface or the portal command-line tool.
- **Query the same data as an AI agent** — every user-facing app is also exposed
  to AI assistants through the Model Context Protocol (MCP).

## Who it is for

- **Biologists** asking targeted questions — "is my peptide proteotypic?", "where
  is this protein modified?", "which studies measured this in liver?".
- **Bioinformaticians and data scientists** who want harmonized, machine-readable
  proteomics results as a foundation for downstream analysis.
- **AI agents and tool builders** that need programmatic, structured access to a
  large, consistently processed proteomics corpus.

## The quantms ecosystem

The portal is one piece of a larger open-source stack. Each component has a
focused job, and the portal ties their outputs together:

- **[quantms workflow](https://github.com/bigbio/quantms)** — a reproducible
  Nextflow pipeline for mass-spectrometry-based proteomics that turns raw data into
  quantified peptides and proteins. It produces the results the portal indexes.
- **[quantms.io](https://github.com/bigbio/quantms.io)** — the standardized data
  representation (QPX) for quantms results, so every dataset shares one schema. See
  the [QPX documentation](https://qpx.quantms.org).
- **[pmultiqc](https://github.com/bigbio/pmultiqc)** — quality-control reporting
  for quantms runs, summarizing the health of each reanalysis.
- **[quantms data portal](https://github.com/bigbio/quantms-portal)** — this
  portal: the index, the search and analytics apps, the web interface, and the
  MCP endpoints for AI agents.

Learn more about the broader project at
[quantms.org](https://quantms.org). The next page,
[Infrastructure](/docs/infrastructure), explains the conceptual architecture that
makes the portal fast, cheap to run, and safe to scale.
