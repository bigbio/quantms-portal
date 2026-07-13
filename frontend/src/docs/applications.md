# Applications

The portal is organized around a small set of focused apps. Each one answers a
specific kind of question over the same standardized corpus. Every app is also
available to AI agents through MCP tools that mirror the exact same queries — see
[AI & MCP](/docs/ai-mcp).

## Peptide & Protein Search

**Find where a peptide or protein has been observed across every indexed dataset,
and explore it biologically.**
[Open Peptide Search →](/apps/peptide-search)

Questions it answers:

- **Which datasets contain this peptide?** Search by sequence with exact,
  contains, or peptidoform matching, and narrow by organism, tissue, instrument,
  collection or peptide length.
- **Which datasets contain this protein?** Search by UniProt accession or by
  gene/protein name. Search is **gene-centric**: an accession, its mnemonic and its
  gene name all resolve to the same protein, so counts are consistent.
- **Where and how is a peptide seen?** A per-peptide profile shows the species,
  tissues and diseases it appears in, whether it is proteotypic, which proteins it
  maps to, and its site-resolved modifications.
- **What does a protein's coverage look like?** A **protein sequence coverage &
  intensity map** renders, residue by residue along the canonical sequence, how
  deeply each position was observed, a normalized intensity, and the absolute
  positions of modification sites.
- **What modifications are present?** Browse the modification vocabulary, with each
  site classified as biologically interesting versus chemistry- or workflow-driven,
  and search peptides by modification and residue.

How to use it: type a peptide sequence or a protein identifier, apply filters, and
open a result to drill into its profile and coverage map.

**Under the hood:** for a technical deep-dive on how a query resolves to a protein
(gene-centric mapping), how observations and proteotypicity are counted, how the
coverage map's per-residue depth and intensity are derived, and how the offline LLM
dataset summaries are written, see [How search works](/docs/how-search-works).

## Dataset Search

**Browse and search datasets and the collections that group them.**
[Open Dataset Search →](/apps/dataset-search)

Questions it answers:

- **What datasets are in the portal, and which collection do they belong to?**
- **Which datasets match my criteria?** Search by free text and filter by
  organism, instrument or collection, then sort and page through results.
- **What is a given dataset about?** Open a dataset to see its metadata —
  organism, tissue, instrument, source study and collection membership.

How to use it: start from a keyword or browse a [collection](/docs/collections),
then refine with facets.

## Statistics

**Understand the portal at the corpus level.**
[Open Statistics →](/statistics)

Questions it answers:

- How many datasets, peptides, peptidoforms and proteins does the portal hold?
- How is the corpus distributed across **species, tissues and instruments**?
- What does **proteome coverage** look like per organism (counted by gene, the
  standardized biological unit)?
- What is the distribution of **modifications**, split into biologically
  interesting versus artifact/label/fixed classes?

These numbers are precomputed offline (see
[Infrastructure](/docs/infrastructure)) and served as a static summary, so the page
loads instantly.

## Also available to AI agents

Every app above mirrors its queries as **MCP tools**, so an AI assistant can run
the same peptide search, protein profile, coverage map, dataset search and
statistics lookups you can. The [AI & MCP](/docs/ai-mcp) page lists the tools.
