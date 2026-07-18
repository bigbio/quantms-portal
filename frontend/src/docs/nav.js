// Shared documentation navigation model.
// Single source of truth for the docs sidebar order + grouping. Both DocsLayout
// (sidebar) and DocsPage (route resolution) read from here, so adding a page is:
//   1. drop a Markdown file in src/docs/<slug>.md
//   2. add a { slug, title } entry below in the right group.
//
// The docs are organized BY APPLICATION: portal-general material up front (Overview,
// the data), then one group per app whose pages all share an app slug prefix
// (ps-* = Peptide & Protein Search, ds-* = Dataset Search, stats-* = Statistics),
// then cross-cutting access/AI and contribution. Adding a new app's docs = a new
// group with its Overview / How-it-works / API pages.
export const DOCS_NAV = [
  {
    group: 'Overview',
    items: [
      { slug: 'introduction', title: 'Introduction' },
      { slug: 'concepts', title: 'Concepts' },
      { slug: 'data', title: 'The data' },
      { slug: 'collections', title: 'Collections' },
      { slug: 'infrastructure', title: 'Infrastructure' },
    ],
  },
  {
    group: 'Applications',
    items: [
      { slug: 'applications', title: 'All applications' },
    ],
  },
  {
    group: 'Peptide & Protein Search',
    items: [
      { slug: 'ps-overview', title: 'Overview' },
      { slug: 'ps-how-search-works', title: 'How search works' },
      { slug: 'ps-gpp', title: 'Evidence quality (GPP)' },
      { slug: 'ps-api', title: 'API & MCP' },
    ],
  },
  {
    group: 'Dataset Search',
    items: [
      { slug: 'ds-overview', title: 'Overview' },
    ],
  },
  {
    group: 'Statistics',
    items: [
      { slug: 'stats-overview', title: 'Overview' },
    ],
  },
  {
    group: 'Data access & AI',
    items: [
      { slug: 'download', title: 'Download & CLI' },
      { slug: 'ai-mcp', title: 'AI & MCP' },
    ],
  },
  {
    group: 'Extend & contribute',
    items: [
      { slug: 'contribute', title: 'Contribute' },
    ],
  },
]

// Old slugs that moved during the by-application restructure -> their new home, so
// existing links (and any bookmarks) keep resolving instead of 404-ing.
export const DOCS_REDIRECTS = {
  'evidence-quality': 'ps-gpp',
  'how-search-works': 'ps-how-search-works',
}

// Flat, ordered list of pages (for prev/next and default resolution).
export const DOCS_ORDER = DOCS_NAV.flatMap((g) => g.items)

// First page is the docs landing target.
export const DOCS_DEFAULT = DOCS_ORDER[0].slug
