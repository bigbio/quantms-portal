# AI & MCP

The portal is **AI-native**: everything a person can do in the web apps, an AI
agent can do too. Both go through the same query engine over the same immutable
data (see [Infrastructure](/docs/infrastructure)), so a person and an assistant
asking the same question get the same answer.

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
