import { apiGet } from './api.js'
import { OBSOLETE_APPS, GATEWAY_BASE, DATASET_SEARCH_BASE, PEPTIDE_SEARCH_BASE, COMPASS_BASE, CELL_LINES_BASE, QPX_BASE } from './config.js'

// Curated catalog of the interactive analysis apps, shared by the home page and
// the Applications page. Kept static (rather than the gateway /apps catalog,
// which lists only part of them) so every app appears, including ones still
// marked enabled:false in the manifest. `image` is a screenshot under public/.
// Apps the gateway lists beyond these are appended at runtime (registryApps).
export const APPS = [
  {
    id: 'dataset-search',
    title: 'Dataset Search',
    to: '/apps/dataset-search',
    image: '/images/apps/dataset-search.jpg',
    docs: `${DATASET_SEARCH_BASE}/docs`,
    description: 'Browse and search the reanalyzed dataset corpus by organism, instrument, disease, and other metadata.',
  },
  {
    id: 'peptide-search',
    title: 'Peptide Search',
    to: '/apps/peptide-search',
    image: '/images/apps/peptide-search.jpg',
    docs: `${PEPTIDE_SEARCH_BASE}/docs`,
    description: 'Find peptides and proteins across the whole corpus, with per-dataset evidence and cross-resource links.',
  },
  {
    id: 'cell-lines',
    title: 'Cancer Cell Line Proteome',
    to: '/apps/cell-lines',
    image: '/images/apps/cell-lines.jpg',
    docs: `${CELL_LINES_BASE}/docs`,
    description: 'Per protein: presence and abundance across cancer cell lines, lineages and cancer types, RNA side by side, and its co-expression network. Per line: identity, studies and distinctive proteins.',
  },
  {
    id: 'statistics',
    title: 'Statistics',
    to: '/statistics',
    image: '/images/apps/statistics.jpg',
    description: 'Portal-wide KPIs and distributions: datasets, peptides, proteins, organisms, instruments, and PTMs.',
  },
  {
    id: 'qpx-explore',
    title: 'qpx Dataset Explorer',
    to: '/apps/qpx-explore',
    image: '/images/apps/qpx-explore.jpg',
    docs: `${QPX_BASE}/docs`,
    description: 'Open one qpx dataset and explore it with DuckDB — files, runs, samples, protein-group and peptide search, per-protein detail, and a curated query gallery (PSMs per run, q-value and charge-state distributions, decoy rate).',
  },
  {
    id: 'compass',
    title: 'Proteome Compass',
    to: '/apps/compass',
    image: '/images/apps/compass.jpg',
    docs: `${COMPASS_BASE}/docs`,
    description: 'Cross-species proteome coverage, evidence tiers, and the gaps quantms reanalysis could still close.',
  },
  {
    id: 'differential-expression',
    title: 'Differential Expression',
    to: '/differential-expression',
    description: 'Pick a dataset, contrast conditions, and explore differential expression — volcano, table, heatmap, and QC.',
    obsoleteNote: 'Retired: its datasets were old pre-qpx reanalyses. It will return once the collection is rebuilt.',
  },
].map((a) => ({ ...a, obsolete: OBSOLETE_APPS.has(a.id) }))

// Gateway registry entries that are not analysis apps: the gateway itself and
// the Collections page, which the main navigation links to.
const NOT_APPS = new Set(['quantms-api', 'collections'])

// Enabled apps in the gateway /apps registry that the curated list does not
// cover yet, so a newly registered app appears without a portal release. They
// have no portal page or screenshot; the card points to the app's API docs.
export async function registryApps() {
  const { apps = [] } = await apiGet(GATEWAY_BASE, '/apps')
  const curated = new Set(APPS.map((a) => a.id))
  return apps
    .filter((a) => a.enabled && a.kind !== 'gateway' && !NOT_APPS.has(a.id) && !curated.has(a.id) && !OBSOLETE_APPS.has(a.id))
    .map((a) => ({ id: a.id, title: a.title, description: a.description || '', docs: a.docs_url, registry: true }))
}
