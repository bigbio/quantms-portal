# Peptide & Protein Search — Overview

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

## Learn more

- **[How search works](/docs/ps-how-search-works)** — a technical deep-dive on how a query
  resolves to a protein (gene-centric mapping), how observations and proteotypicity are counted,
  how the coverage map's per-residue depth and intensity are derived, and how the offline LLM
  dataset summaries are written.
- **[Evidence quality (GPP)](/docs/ps-gpp)** — the Global Peptide Probability score, the
  high-confidence filter, and how the default cutoff is calibrated.

## Also available to AI agents

The same queries — peptide search, protein profile, coverage map — are exposed as **MCP tools**,
so an AI assistant can run exactly what you can. See [AI & MCP](/docs/ai-mcp).
