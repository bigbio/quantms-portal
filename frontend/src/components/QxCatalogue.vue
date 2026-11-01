<template>
  <section class="qc" :aria-busy="loading">
    <p class="qc-lead">
      Every dataset in the quantms catalogue, read live from dataset search. Filter by collection,
      organism or instrument, then click a row to open it here — or enter a dataset ref above.
    </p>

    <div v-if="error" class="notice">
      Could not load the dataset catalogue.
      <button class="page-btn" style="margin-left: 12px" @click="load">Retry</button>
    </div>
    <QxProgress v-else-if="loading" class="qc-progress" label="Loading the dataset catalogue…" />

    <template v-else>
      <!-- What the current selection holds -->
      <dl class="qc-totals">
        <div v-for="t in totals" :key="t.label">
          <dd>{{ t.value }}</dd>
          <dt>{{ t.label }}</dt>
        </div>
      </dl>

      <p v-if="starts.length" class="qc-starts">
        <span>Good places to start:</span>
        <button v-for="ex in starts" :key="ex.accession" type="button" class="qc-start" :title="ex.why" @click="$emit('open', ex.ref)">
          <code>{{ ex.accession }}</code> {{ ex.title }} <small>{{ ex.kind }}</small>
        </button>
      </p>

      <!-- Facets: counts within the other filters; colours give the taxonomic group and mass analyser -->
      <div class="qc-facets">
        <section v-for="f in facets" :key="f.key" class="qc-facet">
          <h3>{{ f.title }}<small v-if="f.note">{{ f.note }}</small></h3>
          <ul>
            <li v-for="o in f.shown" :key="o.value">
              <button
                type="button"
                class="qc-opt"
                :class="{ on: filters[f.key] === o.value }"
                :aria-pressed="filters[f.key] === o.value"
                :title="o.group ? `${o.label} · ${o.group}` : o.label"
                @click="toggle(f.key, o.value)"
              >
                <span class="qc-opt-label"><i :style="{ background: o.colour }" />{{ o.label }}</span>
                <span class="qc-opt-bar"><b :style="{ width: `${(100 * o.n) / f.max}%`, background: o.colour === 'transparent' ? 'var(--border)' : o.colour }" /></span>
                <span class="qc-opt-n">{{ o.n }}</span>
              </button>
            </li>
          </ul>
          <button v-if="f.options.length > FACET_ROWS" type="button" class="qc-more" @click="expanded[f.key] = !expanded[f.key]">
            {{ expanded[f.key] ? 'Show fewer' : `Show all ${f.options.length}` }}
          </button>
        </section>
      </div>
      <p v-if="taxaFailed" class="qc-note">Taxonomic groups could not be looked up in UniProt; organisms are grey.</p>

      <div class="filter-bar qc-bar">
        <input
          v-model="q"
          type="search"
          class="filter-search qc-search"
          placeholder="Search accession, title, keyword, tissue, disease…"
          aria-label="Search datasets"
        />
        <button v-if="hasFilters" class="page-btn" @click="clear">Clear filters</button>
        <span class="result-count">{{ filtered.length.toLocaleString() }} of {{ all.length.toLocaleString() }} datasets</span>
      </div>

      <div class="dataset-table-wrap">
        <table class="dataset-table qc-table">
          <thead>
            <tr>
              <th v-for="c in COLUMNS" :key="c.key" :class="{ num: c.num }" :aria-sort="ariaSort(c)">
                <button v-if="c.sort" type="button" class="qc-sort" @click="sortBy(c)">
                  {{ c.label }}<span>{{ sort.key === c.sort ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '' }}</span>
                </button>
                <template v-else>{{ c.label }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length"><td :colspan="COLUMNS.length" class="qc-empty">No datasets match.</td></tr>
            <tr
              v-for="d in pageRows"
              :key="d.dataset_ref"
              class="qc-row"
              tabindex="0"
              :aria-label="`Open ${d.accession} in the explorer`"
              @click="$emit('open', d.dataset_ref)"
              @keydown.enter.prevent="$emit('open', d.dataset_ref)"
            >
              <td><code class="qc-acc">{{ d.accession }}</code></td>
              <td class="qc-title-cell">
                <span v-if="d.title && d.title !== d.accession" class="qc-title" :title="d.title">{{ d.title }}</span>
                <span class="qc-tags">
                  <span v-for="c in collectionsOf(d)" :key="c" class="tag" :class="collectionTag(c)">{{ collectionTitle(c) }}</span>
                </span>
              </td>
              <td class="qc-dot-cell" :title="taxonOf(d.organism).group"><i :style="{ background: taxonOf(d.organism).colour }" />{{ organismLabel(d.organism) }}</td>
              <td class="qc-dot-cell" :title="analyserGroup(instrumentLabel(d)).group"><i :style="{ background: analyserGroup(instrumentLabel(d)).colour }" />{{ instrumentLabel(d) || '—' }}</td>
              <td class="td-num">{{ formatNum(d.samples) }}</td>
              <td class="td-num">{{ formatNum(d.proteins) }}</td>
              <td class="td-num">{{ formatNum(d.peptides) }}</td>
              <td class="td-num">{{ formatBig(d.psm_count) }}</td>
              <td class="td-num">{{ formatBytes(d.total_size) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="pages > 1" class="pagination">
        <button class="page-btn" :class="{ disabled: page === 1 }" :disabled="page === 1" @click="page--">← Prev</button>
        <span class="page-info">Page {{ page }} of {{ pages }}</span>
        <button class="page-btn" :class="{ disabled: page === pages }" :disabled="page === pages" @click="page++">Next →</button>
      </div>
    </template>
  </section>
</template>

<script setup>
// Start page of the explorer: the whole dataset catalogue as a filterable table.
// The catalogue is small enough to load whole, so filters, facet counts and totals
// answer at once; organisms take their taxonomic group's colour (UniProt) and
// instruments their mass analyser's, as on the Statistics page.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import QxProgress from './QxProgress.vue'
import { apiGet } from '../api.js'
import { DATASET_SEARCH_BASE } from '../config.js'
import { analyserGroup, taxonGroup, useGroups } from '../chartGroups.js'
import { chartColor } from '../utils/chartColors.js'
import { cleanInstrument, collectionColour, collectionTag, formatBig, formatBytes, formatNum } from '../utils/format.js'

const props = defineProps({
  // [{ accession, title, kind, why }], resolved to their current version from the catalogue
  examples: { type: Array, default: () => [] },
})
defineEmits(['open'])

const PAGE = 25
const FACET_ROWS = 6
const PAGE_SIZE = 200 // the most dataset search returns per page

const all = ref([])
const loading = ref(true)
const error = ref(false)

async function load() {
  loading.value = true
  error.value = false
  try {
    const get = (page) => apiGet(DATASET_SEARCH_BASE, '/datasets', { page, page_size: PAGE_SIZE })
    const first = await get(1)
    const rest = await Promise.all(Array.from({ length: Math.max(0, (first.total_pages || 1) - 1) }, (_, i) => get(i + 2)))
    all.value = [first, ...rest].flatMap((d) => d.datasets || []).filter((d) => d.dataset_ref)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)

// --- labels and colours --------------------------------------------------------------

const collectionsOf = (d) => (d.collections && d.collections.length ? d.collections : [d.collection]).filter(Boolean)
const titles = computed(() => Object.fromEntries(all.value.filter((d) => d.collection_title).map((d) => [d.collection, d.collection_title])))
const collectionTitle = (c) => titles.value[c] || c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g, ' ')
const organismLabel = (o) => (o ? o.charAt(0).toUpperCase() + o.slice(1) : '—')
const instrumentLabel = (d) => cleanInstrument(d.instrument)

const organisms = computed(() => [...new Set(all.value.map((d) => d.organism).filter(Boolean))])
const { groups: taxa, failed: taxaFailed } = useGroups(organisms, taxonGroup)
// still being looked up: an empty ring, not the grey of "no group"
const taxonOf = (o) => taxa.value[o] || { group: taxaFailed.value ? 'Not looked up' : 'Looking up…', colour: taxaFailed.value ? chartColor('other') : 'transparent' }

// --- filtering ------------------------------------------------------------------------

const q = ref('')
const filters = reactive({ collection: '', organism: '', instrument: '' })
const expanded = reactive({})
const hasFilters = computed(() => !!(q.value || filters.collection || filters.organism || filters.instrument))
function toggle(key, value) { filters[key] = filters[key] === value ? '' : value }
function clear() {
  q.value = ''
  Object.assign(filters, { collection: '', organism: '', instrument: '' })
}

const haystack = (d) => [d.accession, d.title, d.organism, instrumentLabel(d), ...collectionsOf(d),
  ...(d.keywords || []), ...(d.tissues || []), ...(d.diseases || [])].join(' ').toLowerCase()
const matchesQuery = (d) => !q.value.trim() || haystack(d).includes(q.value.trim().toLowerCase())
const passes = (d, skip) => matchesQuery(d)
  && (skip === 'collection' || !filters.collection || collectionsOf(d).includes(filters.collection))
  && (skip === 'organism' || !filters.organism || d.organism === filters.organism)
  && (skip === 'instrument' || !filters.instrument || instrumentLabel(d) === filters.instrument)
const filtered = computed(() => all.value.filter((d) => passes(d)))

// Each facet counts the datasets that pass every other filter, so its options stay
// visible after picking one.
function facet(key, title, valuesOf, describe, note = '') {
  const counts = new Map()
  for (const d of all.value) {
    if (!passes(d, key)) continue
    for (const v of valuesOf(d)) counts.set(v, (counts.get(v) || 0) + 1)
  }
  const options = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, n]) => ({ value, n, ...describe(value) }))
  const picked = options.find((o) => o.value === filters[key])
  let shown = expanded[key] ? options : options.slice(0, FACET_ROWS)
  if (picked && !shown.includes(picked)) shown = [...shown, picked]
  return { key, title, note, options, shown, max: Math.max(1, ...options.map((o) => o.n)) }
}
const facets = computed(() => [
  facet('collection', 'Collection', collectionsOf, (c) => ({ label: collectionTitle(c), colour: collectionColour(c) })),
  facet('organism', 'Organism', (d) => (d.organism ? [d.organism] : []),
    (o) => ({ label: organismLabel(o), ...taxonOf(o) }), 'colour: taxonomic group (UniProt)'),
  facet('instrument', 'Instrument', (d) => (instrumentLabel(d) ? [instrumentLabel(d)] : []),
    (i) => ({ label: i, ...analyserGroup(i) }), 'colour: mass analyser'),
])

const sum = (key) => filtered.value.reduce((a, d) => a + (d[key] || 0), 0)
const totals = computed(() => {
  const nOrganisms = new Set(filtered.value.map((d) => d.organism).filter(Boolean)).size
  return [
    { label: hasFilters.value ? `of ${all.value.length.toLocaleString()} datasets` : 'datasets', value: filtered.value.length.toLocaleString() },
    { label: nOrganisms === 1 ? 'organism' : 'organisms', value: nOrganisms.toLocaleString() },
    { label: 'samples', value: formatBig(sum('samples')) },
    { label: 'PSMs', value: formatBig(sum('psm_count')) },
    { label: 'of qpx data', value: formatBytes(sum('total_size')) },
  ]
})

const starts = computed(() => props.examples
  .map((ex) => ({ ...ex, ref: all.value.find((d) => d.accession === ex.accession)?.dataset_ref }))
  .filter((ex) => ex.ref))

// --- table ------------------------------------------------------------------------------

const COLUMNS = [
  { key: 'accession', label: 'Accession', sort: 'accession' },
  { key: 'title', label: 'Dataset' },
  { key: 'organism', label: 'Organism' },
  { key: 'instrument', label: 'Instrument' },
  { key: 'samples', label: 'Samples', sort: 'samples', num: true },
  { key: 'proteins', label: 'Proteins', sort: 'proteins', num: true },
  { key: 'peptides', label: 'Peptides', sort: 'peptides', num: true },
  { key: 'psms', label: 'PSMs', sort: 'psm_count', num: true },
  { key: 'size', label: 'Size', sort: 'total_size', num: true },
]
const sort = reactive({ key: 'peptides', dir: 'desc' })
function sortBy(c) {
  if (sort.key === c.sort) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc'
  else Object.assign(sort, { key: c.sort, dir: c.num ? 'desc' : 'asc' })
}
const ariaSort = (c) => (c.sort && sort.key === c.sort ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined)
const sorted = computed(() => {
  const k = sort.key
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => sign * (k === 'accession'
    ? a.accession.localeCompare(b.accession, undefined, { numeric: true })
    : (a[k] || 0) - (b[k] || 0)))
})

const page = ref(1)
const pages = computed(() => Math.max(1, Math.ceil(sorted.value.length / PAGE)))
const pageRows = computed(() => sorted.value.slice((page.value - 1) * PAGE, page.value * PAGE))
watch([q, () => ({ ...filters }), () => sort.key, () => sort.dir], () => { page.value = 1 })
</script>

<style scoped>
.qc { margin-top: 4px; }
.qc-lead { color: var(--text-secondary); margin: 0 0 16px; max-width: 820px; }
.qc-progress { max-width: 420px; margin: 24px 0; }
.qc-totals { display: flex; flex-wrap: wrap; gap: 8px 32px; margin: 0 0 14px; }
.qc-totals div { display: flex; align-items: baseline; gap: 6px; }
.qc-totals dd { margin: 0; font-family: var(--mono); font-size: 22px; font-weight: 700; color: var(--text-primary); }
.qc-totals dt { font-size: 13px; color: var(--text-muted); }
.qc-starts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0 0 16px; font-size: 13px; color: var(--text-muted); }
.qc-start { font: inherit; font-size: 13px; padding: 4px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface);
  color: var(--text-primary); cursor: pointer; }
.qc-start:hover, .qc-start:focus-visible { border-color: var(--indigo); outline: none; }
.qc-start code { font-family: var(--mono); font-size: 12px; color: var(--indigo); }
.qc-start small { color: var(--text-muted); font-size: 12px; }
.qc-facets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 8px; }
@media (max-width: 900px) { .qc-facets { grid-template-columns: 1fr; } }
.qc-facet { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 12px 14px; min-width: 0; }
.qc-facet h3 { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.qc-facet h3 small { font-weight: 400; font-size: 11px; color: var(--text-muted); }
.qc-facet ul { list-style: none; margin: 0; padding: 0; }
.qc-opt { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(40px, 1fr) 36px; align-items: center; gap: 8px; width: 100%;
  padding: 3px 6px; border: 1px solid transparent; border-radius: 6px; background: none; font: inherit; font-size: 12px;
  color: var(--text-primary); text-align: left; cursor: pointer; }
.qc-opt:hover, .qc-opt:focus-visible { border-color: var(--border); outline: none; }
.qc-opt.on { border-color: var(--indigo); background: var(--brand-tint); }
.qc-opt-label { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qc-opt-label i, .qc-dot-cell i { width: 9px; height: 9px; border-radius: 50%; flex: none; display: inline-block;
  box-shadow: inset 0 0 0 1px var(--border); transition: background-color 0.3s; }
.qc-opt-bar { height: 6px; border-radius: 3px; background: var(--bg-alt); overflow: hidden; }
.qc-opt-bar b { display: block; height: 100%; border-radius: 3px; }
.qc-opt-n { font-family: var(--mono); color: var(--text-muted); text-align: right; }
.qc-more { all: unset; cursor: pointer; margin: 6px 0 0 6px; font-size: 12px; color: var(--indigo); }
.qc-more:hover, .qc-more:focus-visible { text-decoration: underline; }
.qc-note { font-size: 12px; color: var(--text-muted); margin: 0 0 8px; }
.qc-bar { margin-top: 12px; }
.qc-search { width: 320px; max-width: 100%; }
.qc-table th.num { text-align: right; }
.qc-table .td-num { white-space: nowrap; }
.qc-sort { all: unset; cursor: pointer; white-space: nowrap; }
.qc-sort:hover, .qc-sort:focus-visible { color: var(--indigo); }
.qc-sort span { color: var(--indigo); }
.qc-row { cursor: pointer; }
.qc-row:focus-visible { outline: 2px solid var(--indigo); outline-offset: -2px; }
.qc-acc { font-family: var(--mono); font-size: 13px; color: var(--indigo); white-space: nowrap; }
.qc-title-cell { min-width: 260px; max-width: 460px; }
.qc-title { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px; }
.qc-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.qc-tags .tag { font-size: 11px; }
.qc-dot-cell { font-size: 13px; white-space: nowrap; }
.qc-dot-cell i { margin-right: 6px; vertical-align: 0; }
.qc-empty { text-align: center; padding: 32px; color: var(--text-muted); }
</style>
