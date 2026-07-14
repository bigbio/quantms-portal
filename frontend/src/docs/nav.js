// Shared documentation navigation model.
// Single source of truth for the docs sidebar order + grouping. Both DocsLayout
// (sidebar) and DocsPage (route resolution) read from here, so adding a page is:
//   1. drop a Markdown file in src/docs/<slug>.md
//   2. add a { slug, title } entry below in the right group.
export const DOCS_NAV = [
  {
    group: 'Getting started',
    items: [
      { slug: 'introduction', title: 'Introduction' },
      { slug: 'infrastructure', title: 'Infrastructure' },
    ],
  },
  {
    group: 'Using the portal',
    items: [
      { slug: 'applications', title: 'Applications' },
      { slug: 'how-search-works', title: 'How search works' },
      { slug: 'evidence-quality', title: 'Evidence quality' },
      { slug: 'data', title: 'Data' },
      { slug: 'collections', title: 'Collections' },
      { slug: 'download', title: 'Download data' },
    ],
  },
  {
    group: 'Extend & contribute',
    items: [
      { slug: 'contribute', title: 'Contribute' },
      { slug: 'ai-mcp', title: 'AI & MCP' },
    ],
  },
]

// Flat, ordered list of pages (for prev/next and default resolution).
export const DOCS_ORDER = DOCS_NAV.flatMap((g) => g.items)

// First page is the docs landing target.
export const DOCS_DEFAULT = DOCS_ORDER[0].slug
