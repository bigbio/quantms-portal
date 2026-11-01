<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="crumbs">
        <router-link to="/collections" class="crumb">Collections</router-link>
        <span>›</span>
        <router-link to="/applications" class="crumb">Applications</router-link>
        <span>›</span>
        <span class="crumb-current">qpx Dataset Explorer</span>
      </div>

      <h1 class="qx-title">qpx Dataset Explorer</h1>
      <p class="qx-sub">
        Review one content-addressed qpx dataset (<code>accession/phash</code>): its quality
        control and the evidence behind it — runs, samples, protein groups, peptides, features and PSMs.
        <router-link to="/docs/applications" class="qx-doc-link">Apps overview →</router-link>
      </p>

      <!-- Dataset selector -->
      <div class="qx-picker">
        <input
          v-model="refInput"
          class="qx-input"
          placeholder="e.g. MSV000085836/8e4c044b513d"
          spellcheck="false"
          @keyup.enter="loadRef"
        />
        <button class="page-btn primary" :disabled="!refInput.trim() || loading" @click="loadRef">
          {{ loading ? 'Opening…' : 'Explore' }}
        </button>
      </div>

      <!-- Not loaded: the catalogue to pick from -->
      <QxCatalogue v-if="!loaded && !loading && !error && !refFromQuery(route.query)" :examples="START_EXAMPLES" @open="(r) => router.push({ query: { ref: r } })" />

      <!-- Loading -->
      <QxProgress v-else-if="loading" class="qx-opening" label="Opening the dataset with DuckDB…" />

      <!-- Error -->
      <div v-else-if="error" class="notice">
        {{ error }}
        <button class="page-btn" style="margin-left: 12px" @click="loadRef">Retry</button>
      </div>

      <!-- Loaded -->
      <template v-else-if="overview">
        <!-- What the dataset is: catalogue entry, organisms, instruments, acquisition -->
        <header class="qx-dataset">
          <div class="qx-dataset-main">
            <span class="qx-dataset-ref">{{ visibleRef }}</span>
            <h2 v-if="dsInfo && dsInfo.title && dsInfo.title !== overview.accession" class="qx-dataset-title">{{ dsInfo.title }}</h2>
            <p v-if="dsInfo" class="qx-dataset-links">
              <router-link v-if="dsInfo.collection" :to="`/collections/${dsInfo.collection}`">{{ dsInfo.collection_title || dsInfo.collection }}</router-link>
              <router-link v-if="dsInfo.collection" :to="`/collections/${dsInfo.collection}/${overview.accession}/${overview.phash}`">Dataset page</router-link>
              <a v-if="dsInfo.source_url" :href="dsInfo.source_url" target="_blank" rel="noopener">{{ dsInfo.source }} {{ overview.accession }}</a>
              <a :href="browseUrl(visibleRef)" target="_blank" rel="noopener">Files<template v-if="isCurrent && dsInfo.total_size"> · {{ formatBytes(dsInfo.total_size) }}</template></a>
            </p>
            <p v-if="dsInfo && !isCurrent && dsInfo.dataset_ref" class="qx-hint qx-dataset-version">
              The catalogue lists <router-link :to="{ query: { ref: dsInfo.dataset_ref } }">{{ dsInfo.dataset_ref }}</router-link> as this dataset's current version.
            </p>
          </div>
          <dl class="qx-dataset-facts">
            <div><dt>Organisms</dt><dd>{{ overview.organisms.join(', ') || '—' }}</dd></div>
            <div><dt>Instruments</dt><dd>{{ overview.instruments.join(', ') || '—' }}</dd></div>
            <div><dt>Acquisition</dt><dd>{{ overview.acquisition_methods.join(', ') || '—' }}</dd></div>
          </dl>
        </header>

        <!-- Overview cards -->
        <div class="qx-cards">
          <div v-for="c in cards" :key="c.label" class="qx-card">
            <div class="qx-card-val">{{ c.value }}</div>
            <div class="qx-card-label">{{ c.label }}</div>
          </div>
        </div>

        <!-- Tabs: a tab whose table this dataset lacks is disabled -->
        <div class="qx-tabs" role="tablist">
          <button
            v-for="t in tabs"
            :key="t.id"
            role="tab"
            class="qx-tab"
            :class="{ active: tab === t.id }"
            :aria-selected="tab === t.id"
            :disabled="!tabAvailable(t)"
            :title="tabAvailable(t) ? '' : `This dataset has no ${[t.needs].flat().join(' or ')} table`"
            @click="setTab(t.id)"
          >{{ t.label }}</button>
        </div>

        <!-- Overview tab -->
        <div v-if="tab === 'overview'" class="qx-tab-body">
          <QxColourBy v-if="colourChoices.length" v-model="colourField" v-model:highlight="highlight" :fields="colourChoices" :legend="colouring ? colouring.scale.legend : []" :note="colourNote" />
          <QxOverviewStats
            :dataset-ref="visibleRef"
            :samples="meta.samples.rows"
            :runs="meta.runs.rows"
            :scales="scales"
            :colouring="colouring"
            @colour-by="colourField = $event"
          />
          <details v-if="filesList.length" class="qx-files">
            <summary>qpx files ({{ filesList.length }})</summary>
            <ul class="qx-file-list">
              <li v-for="f in filesList" :key="f">{{ f }}</li>
            </ul>
          </details>
          <p v-if="missingViews.length" class="qx-hint">
            This dataset has no {{ missingViews.join(', ') }} table; the tabs that need it are disabled.
          </p>
        </div>

        <!-- QC: per-run metrics and per-sample intensity, each with outlier flags -->
        <div v-else-if="tab === 'qc'" class="qx-tab-body">
          <QxColourBy v-if="colourChoices.length" v-model="colourField" v-model:highlight="highlight" :fields="colourChoices" :legend="colouring ? colouring.scale.legend : []" :note="colourNote" />
          <h3 class="qx-section">Runs</h3>
          <QxRunQc :dataset-ref="visibleRef" :colouring="colouring" />
          <h3 class="qx-section">Samples</h3>
          <QxSampleIntensity :dataset-ref="visibleRef" :colouring="colouring" />
        </div>

        <!-- Runs / Samples: small tables, loaded whole and sorted here -->
        <div v-else-if="tab === 'runs' || tab === 'samples'" class="qx-tab-body">
          <div class="filter-bar">
            <span class="muted">{{ meta[tab].rows.length.toLocaleString() }} {{ tab }}</span>
          </div>
          <QxTable
            :columns="meta[tab].columns"
            :rows="meta[tab].rows"
            :loading="meta[tab].loading"
            :error="meta[tab].error"
            :sort-key="meta[tab].columns[0]"
            sort-dir="asc"
            :empty-text="`No ${tab}.`"
          />
        </div>

        <!-- Proteins -->
        <div v-else-if="tab === 'proteins'" class="qx-tab-body">
          <div class="filter-bar">
            <div class="filter-group">
              <input v-model="sv.proteins.q" class="qx-input" placeholder="Filter by accession or gene…" @keyup.enter="loadServer('proteins')" />
              <button class="page-btn" :disabled="sv.proteins.loading" @click="loadServer('proteins')">Search</button>
            </div>
            <span class="muted">{{ shownText('proteins') }} · click a protein for its peptides and per-run evidence</span>
          </div>

          <div v-if="selectedProtein" ref="detailEl" class="qx-prot-detail">
            <div class="qx-detail-head">
              <strong class="qx-mono">{{ selectedProtein }}</strong>
              <button class="page-btn" @click="selectedProtein = ''">Close</button>
            </div>
            <p v-if="proteinDetail.error" class="notice">{{ proteinDetail.error }}</p>
            <div v-else-if="proteinDetail.loading" class="qt-state-inline">Loading peptides and per-run evidence…</div>
            <template v-else>
              <div class="qx-block-label">
                Per run (summed feature intensity)
                <span v-if="proteinDetail.expr && proteinDetail.expr.group_intensity != null" class="muted qx-normal">
                  · group intensity {{ formatCell(proteinDetail.expr.group_intensity, 'intensity').text }}
                </span>
              </div>
              <QxTable
                :columns="['run', 'n_features', 'summed_intensity', 'max_feature_intensity']"
                :rows="(proteinDetail.expr && proteinDetail.expr.per_run) || []"
                sort-key="summed_intensity"
                empty-text="No per-run feature evidence for this protein."
              />
              <div class="qx-block-label" style="margin-top: 16px">Supporting peptides</div>
              <QxTable
                :columns="['sequence', 'charge', 'run_file_name', 'rt', 'peptide_qvalue']"
                :rows="proteinDetail.peptides"
                sort-key="peptide_qvalue"
                sort-dir="asc"
                empty-text="No supporting peptides found."
              />
            </template>
          </div>

          <QxTable
            :columns="sv.proteins.columns"
            :rows="sv.proteins.rows"
            server-sort
            :sort-key="sv.proteins.sort.key"
            :sort-dir="sv.proteins.sort.dir"
            :loading="sv.proteins.loading"
            :error="sv.proteins.error"
            row-key="anchor_protein"
            :selected="selectedProtein"
            empty-text="No protein groups match."
            @sort="(s) => resort('proteins', s)"
          >
            <template #cell="{ column, value, text }">
              <button v-if="column === 'anchor_protein'" class="qx-link" @click="openProtein(value)">{{ text }}</button>
              <template v-else>{{ text }}</template>
            </template>
          </QxTable>
        </div>

        <!-- Peptides -->
        <div v-else-if="tab === 'peptides'" class="qx-tab-body">
          <div class="filter-bar">
            <div class="filter-group">
              <input v-model="sv.peptides.q" class="qx-input" placeholder="Filter by sequence…" @keyup.enter="loadServer('peptides')" />
              <button class="page-btn" :disabled="sv.peptides.loading" @click="loadServer('peptides')">Search</button>
            </div>
            <span class="muted">{{ shownText('peptides') }}</span>
          </div>
          <QxTable
            :columns="sv.peptides.columns" :rows="sv.peptides.rows" server-sort
            :sort-key="sv.peptides.sort.key" :sort-dir="sv.peptides.sort.dir"
            :loading="sv.peptides.loading" :error="sv.peptides.error"
            empty-text="No peptides match." @sort="(s) => resort('peptides', s)"
          />
        </div>

        <!-- Features -->
        <div v-else-if="tab === 'features'" class="qx-tab-body">
          <div class="filter-bar">
            <div class="filter-group">
              <input v-model="sv.features.q" class="qx-input" placeholder="Filter by sequence or peptidoform…" @keyup.enter="loadServer('features')" />
              <input v-model="featureCharge" type="number" min="1" max="10" class="qx-input qx-input-num" placeholder="charge" title="Precursor charge" @keyup.enter="loadServer('features')" />
              <input v-model="featureQmax" type="number" min="0" max="1" step="0.0001" class="qx-input qx-input-num" placeholder="max q" title="Max peptide q-value" @keyup.enter="loadServer('features')" />
              <select v-model="featureMod" class="qx-input qx-input-num" title="Only features carrying this modification" @change="loadServer('features')">
                <option value="">any PTM</option>
                <option v-for="m in ptmNames" :key="m" :value="m">{{ m }}</option>
              </select>
              <button class="page-btn" :disabled="sv.features.loading" @click="loadServer('features')">Search</button>
            </div>
            <span class="muted">{{ shownText('features') }}</span>
          </div>
          <QxTable
            :columns="sv.features.columns" :rows="sv.features.rows" server-sort
            :sort-key="sv.features.sort.key" :sort-dir="sv.features.sort.dir"
            :loading="sv.features.loading" :error="sv.features.error"
            empty-text="No features match your filters." @sort="(s) => resort('features', s)"
          />
        </div>

        <!-- PTMs -->
        <div v-else-if="tab === 'ptms'" class="qx-tab-body">
          <p v-if="meta.ptms.source === 'none'" class="qx-hint">
            This dataset carries no PTM annotation.
          </p>
          <template v-else>
            <p v-if="meta.ptms.table === 'psm'" class="qx-hint">
              This dataset has no feature table, so modifications are counted over target PSMs.
            </p>
            <QxTable
              :columns="meta.ptms.columns" :rows="meta.ptms.rows"
              :loading="meta.ptms.loading" :error="meta.ptms.error"
              :sort-key="meta.ptms.columns[1] || ''" empty-text="No modified peptides in this dataset."
            >
              <template #cell="{ column, value, text }">
                <button v-if="column === 'modification' && meta.ptms.table === 'feature'" class="qx-link" :title="`Show features carrying ${value}`" @click="showModFeatures(value)">{{ text }}</button>
                <template v-else>{{ text }}</template>
              </template>
            </QxTable>
          </template>
        </div>

        <!-- PSMs -->
        <div v-else-if="tab === 'psms'" class="qx-tab-body">
          <div class="filter-bar">
            <div class="filter-group">
              <input v-model="sv.psms.q" class="qx-input" placeholder="Filter PSMs by peptide…" @keyup.enter="loadServer('psms')" />
              <button class="page-btn" :disabled="sv.psms.loading" @click="loadServer('psms')">Search</button>
            </div>
            <span class="muted">{{ shownText('psms') }}</span>
          </div>
          <p class="qx-hint">Scan-level PSMs from the psm table: scan, retention time, PEP and precursor m/z.</p>
          <QxTable
            :columns="sv.psms.columns" :rows="sv.psms.rows" server-sort
            :sort-key="sv.psms.sort.key" :sort-dir="sv.psms.sort.dir"
            :loading="sv.psms.loading" :error="sv.psms.error"
            empty-text="No PSMs match." @sort="(s) => resort('psms', s)"
          />
        </div>

        <!-- Queries tab: SQL editor -->
        <div v-else-if="tab === 'queries'" class="qx-tab-body">
          <div v-if="schemaViews.length" class="qx-builder">
            <div class="qx-block-label">Build a query</div>
            <p class="qx-hint">Pick a table, filters and summaries; each change rewrites the SQL below.</p>
            <QpxQueryBuilder :key="visibleRef" :views="schemaViews" @sql="onBuilderSql" />
          </div>
          <p v-else-if="schemaLoading" class="muted">Loading tables…</p>

          <div class="qx-sql-box">
            <div class="qx-block-label">SQL editor (DuckDB · read-only SELECT)</div>
            <textarea
              v-model="sqlText"
              rows="7"
              class="qx-sql"
              spellcheck="false"
              placeholder="SELECT sequence, charge, peptide_qvalue FROM feature WHERE NOT is_decoy ORDER BY peptide_qvalue ASC LIMIT 10"
            ></textarea>
            <div class="filter-group" style="margin-top: 8px">
              <label class="muted" title="Rows returned, at most">max rows</label>
              <input v-model.number="sqlLimit" type="number" min="1" :max="sqlMaxRows" class="qx-input qx-input-sm" />
              <button class="page-btn primary" :disabled="sqlRunning || !sqlText.trim()" @click="runSql">
                {{ sqlRunning ? 'Running…' : 'Run' }}
              </button>
              <span class="muted qx-sql-hint">SELECT-only · confined to this dataset · max {{ sqlMaxRows }} rows</span>
            </div>
            <p v-if="sqlInfo" class="qx-hint" style="margin-top: 6px">{{ sqlInfo }}</p>
            <p v-if="sqlError" class="notice">{{ sqlError }}</p>
          </div>

          <!-- Result -->
          <div v-if="sqlResult" class="qx-sql-result">
            <div class="qx-block-label" style="margin-top: 18px">
              Result
              <span v-if="sqlResult.truncated" class="muted" style="text-transform: none">· truncated at {{ sqlResult.limit }} rows</span>
            </div>
            <div v-if="sqlResult.error" class="notice">{{ sqlResult.error }}</div>
            <div v-else-if="sqlResult.available === false" class="placeholder-empty">No qpx views are available in this dataset.</div>
            <QxTable v-else :columns="sqlResult.columns || []" :rows="sqlResult.rows || []" empty-text="No rows." />
          </div>

          <!-- Examples (curated queries become editable starting points) -->
          <div class="qx-examples">
            <div class="qx-block-label" style="margin-top: 18px">Examples</div>
            <div class="qx-query-list">
              <button
                v-for="ex in examples"
                :key="ex.id"
                class="qx-query-item"
                :class="{ active: exampleBusy === ex.id }"
                :disabled="exampleBusy !== '' && exampleBusy !== ex.id"
                @click="loadExample(ex)"
              >
                <strong>{{ ex.title }}</strong>
                <span class="muted">{{ ex.description }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  qpxOverview, qpxRuns, qpxSamples, qpxSearchProteins,
  qpxSearchPeptides, qpxProtein, qpxProteinExpression,
  qpxSearchFeatures, qpxPtms, qpxPsms, qpxSchema, qpxRunSql,
} from '../qpx.js'
import QpxQueryBuilder from '../components/QpxQueryBuilder.vue'
import QxTable from '../components/QxTable.vue'
import QxProgress from '../components/QxProgress.vue'
import QxOverviewStats from '../components/QxOverviewStats.vue'
import QxRunQc from '../components/QxRunQc.vue'
import QxSampleIntensity from '../components/QxSampleIntensity.vue'
import QxCatalogue from '../components/QxCatalogue.vue'
import QxColourBy from '../components/QxColourBy.vue'
import { apiGet } from '../api.js'
import { DATASET_SEARCH_BASE, browseUrl } from '../config.js'
import { formatCell } from '../qpxFormat.js'
import { formatBytes } from '../utils/format.js'
import { annotation, colourFields, colourScale, GROUPED_FIELDS, runAnnotation, useSampleGroups } from '../sampleColors.js'

const route = useRoute()
const router = useRouter()

//: `needs` = the qpx table a tab reads (or a list, any of which will do); the tab is disabled without it.
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'qc', label: 'QC', needs: 'feature' },
  { id: 'runs', label: 'Runs', needs: 'run' },
  { id: 'samples', label: 'Samples', needs: 'sample' },
  { id: 'proteins', label: 'Proteins', needs: 'pg' },
  { id: 'peptides', label: 'Peptides', needs: 'psm' },
  { id: 'features', label: 'Features', needs: 'feature' },
  { id: 'ptms', label: 'PTMs', needs: ['feature', 'psm'] },
  { id: 'psms', label: 'PSMs', needs: 'psm' },
  { id: 'queries', label: 'Query' },
]

//: Curated queries, surfaced as clickable, editable examples for the SQL editor.
const examples = [
  {
    id: 'top_proteins',
    title: 'Protein groups by intensity',
    description: 'Top protein groups, strongest first.',
    sql: "SELECT anchor_protein, global_qvalue, intensity FROM pg WHERE NOT is_decoy ORDER BY intensity DESC NULLS LAST LIMIT 20",
  },
  {
    id: 'psms_per_run',
    title: 'PSMs and peptides per run',
    description: 'Count PSMs and distinct peptides per run file.',
    sql: "SELECT run_file_name AS run, count(*) AS n_psms, count(DISTINCT sequence) AS n_peptides FROM psm WHERE NOT is_decoy GROUP BY run_file_name ORDER BY n_psms DESC LIMIT 20",
  },
  {
    id: 'features_per_run',
    title: 'Feature evidence per run',
    description: 'Count peptide features (and distinct sequences) per run file.',
    sql: "SELECT run_file_name AS run, count(*) AS n_features, count(DISTINCT sequence) AS n_peptides FROM feature WHERE NOT is_decoy GROUP BY run_file_name ORDER BY n_features DESC LIMIT 20",
  },
  {
    id: 'top_peptides',
    title: 'Most observed peptides',
    description: 'Rank peptides by how many PSMs support them.',
    sql: "SELECT sequence, count(*) AS n_psms, count(DISTINCT run_file_name) AS n_runs FROM psm WHERE NOT is_decoy GROUP BY sequence ORDER BY n_psms DESC LIMIT 20",
  },
  {
    id: 'charge_distribution',
    title: 'Precursor charge distribution',
    description: 'How many features carry each precursor charge state.',
    sql: "SELECT charge, count(*) AS n FROM feature WHERE NOT is_decoy GROUP BY charge ORDER BY n DESC LIMIT 20",
  },
  {
    id: 'peptide_lengths',
    title: 'Peptide length distribution',
    description: 'Number of features by peptide length (residues).',
    sql: "SELECT length(sequence) AS n_residues, count(*) AS n FROM feature WHERE NOT is_decoy GROUP BY length(sequence) ORDER BY n_residues LIMIT 60",
  },
  {
    id: 'decoy_rate',
    title: 'Decoy rate',
    description: 'Share of target-decoy decoy features in the feature table.',
    sql: "SELECT sum(CASE WHEN is_decoy THEN 1 ELSE 0 END) AS n_decoys, count(*) AS n_total, round(100.0 * sum(CASE WHEN is_decoy THEN 1.0 ELSE 0.0 END) / nullif(count(*), 0), 3) AS decoy_pct FROM feature",
  },
]
const PAGE = 200

const refInput = ref('')
const visibleRef = ref('')
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const tab = ref('overview')

const overview = ref(null)
const filesList = ref([])
// The dataset's catalogue entry (dataset search), describing its current version.
const dsInfo = ref(null)
const isCurrent = computed(() => dsInfo.value?.dataset_ref === visibleRef.value)

//: Large tables: sorted and filtered on the backend, PAGE rows at a time.
const newServerTab = (sortKey, dir) => ({ rows: [], columns: [], loading: false, error: '', q: '', sort: { key: sortKey, dir } })
const sv = reactive({
  proteins: newServerTab('intensity', 'desc'),
  peptides: newServerTab('n_psms', 'desc'),
  features: newServerTab('', 'desc'),
  psms: newServerTab('', 'asc'),
})
const featureCharge = ref('')
const featureQmax = ref('')
const featureMod = ref('')

//: Small tables, loaded whole.
const newMeta = () => ({ rows: [], columns: [], loading: false, error: '', source: '', table: '' })
const meta = reactive({ runs: newMeta(), samples: newMeta(), ptms: newMeta() })

const selectedProtein = ref('')
const proteinDetail = ref({ loading: false, error: '', peptides: [] })
const detailEl = ref(null)

//: SQL editor.
const sqlMaxRows = 2000
const sqlText = ref('')
const sqlLimit = ref(200)
const sqlRunning = ref(false)
const sqlResult = ref(null)
const sqlError = ref('')
const sqlInfo = ref('')
const schemaLoading = ref(false)
const schemaViews = ref([])
const exampleBusy = ref('')

const missingViews = computed(() => {
  if (!overview.value) return []
  return ['feature', 'pg', 'psm', 'sample', 'run'].filter((v) => overview.value.available_views[v] === false)
})

function tabAvailable(t) {
  return !t.needs || !overview.value || [t.needs].flat().some((n) => overview.value.available_views[n] !== false)
}

function count(v) {
  return v == null ? '—' : Number(v).toLocaleString()
}

const cards = computed(() => {
  const ov = overview.value
  if (!ov) return []
  const rc = ov.row_counts || {}
  return [
    { label: 'Protein groups', value: count(ov.protein_groups ?? rc.pg) },
    { label: 'Features', value: count(rc.feature) },
    { label: 'PSMs', value: count(rc.psm) },
    { label: 'Runs', value: count(rc.run) },
    { label: 'Samples', value: count(rc.sample) },
  ]
})

const ptmNames = computed(() => meta.ptms.rows.map((r) => r[0]).filter(Boolean))

//: Sample colouring shared by the Overview and QC charts: the annotation picked,
//: its colours, and how to look up the value of a sample or a run.
const colourField = ref('')
const highlight = ref('')
const colourChoices = computed(() => colourFields(meta.samples.rows))
watch(colourChoices, (c) => {
  if (!c.some((f) => f.key === colourField.value)) colourField.value = c.length ? c[0].key : ''
})
watch(colourField, () => { highlight.value = '' })
// Biological groups of the grouped fields' values (organ system, taxon, ...),
// looked up live; until they arrive a grouped field colours nothing.
const sampleGroups = useSampleGroups(() => meta.samples.rows, () => colourField.value)
const scales = computed(() => {
  const samples = meta.samples.rows
  return Object.fromEntries(colourChoices.value.map((f) => {
    const g = sampleGroups.value[f.key]
    return [f.key, g && g.status === 'pending' ? null : colourScale(samples, f.key, g ? g.groupOf : null)]
  }))
})
const colourNote = computed(() => {
  const f = colourChoices.value.find((x) => x.key === colourField.value)
  const grouped = f && GROUPED_FIELDS[f.key]
  if (!grouped) return ''
  const g = sampleGroups.value[f.key]
  if (!g || g.status === 'pending') return `Looking up each ${f.title.toLowerCase()}'s ${grouped.source}…`
  const scale = scales.value[f.key]
  const how = scale.splits.length && scale.splits[0].family
    ? `Hue: ${grouped.source}; shade: each ${f.title.toLowerCase()}.`
    : `Hue: ${grouped.source}; shade: each ${f.title.toLowerCase()}. Too many values to draw one by one, so the charts group them by ${grouped.source.replace(/ \(.*/, '')}.`
  return g.failed ? `${how} ${g.failed} could not be looked up and are grey.` : how
})
const colouring = computed(() => {
  const field = colourChoices.value.find((f) => f.key === colourField.value)
  if (!field || !scales.value[field.key]) return null
  const samples = meta.samples.rows
  const byId = new Map(samples.map((x) => [x.sample_accession, x]))
  const runSamples = new Map()
  for (const r of meta.runs.rows) {
    const accs = (r.samples || []).map((x) => x.sample_accession)
    runSamples.set(r.run_accession, accs)
    runSamples.set(r.run_file_name, accs)
  }
  return {
    key: field.key,
    title: field.title,
    scale: scales.value[field.key],
    highlight: highlight.value,
    value: (acc) => annotation(byId.get(acc), field.key),
    run: (name) => runAnnotation(runSamples.get(name) || [], byId, field.key),
  }
})

function shownText(id) {
  const n = sv[id].rows.length
  if (sv[id].loading) return 'Loading…'
  return n >= PAGE ? `top ${PAGE.toLocaleString()} shown` : `${n.toLocaleString()} shown`
}

function resetDerived() {
  overview.value = null
  filesList.value = []
  dsInfo.value = null
  highlight.value = ''
  Object.assign(sv.proteins, newServerTab('intensity', 'desc'))
  Object.assign(sv.peptides, newServerTab('n_psms', 'desc'))
  Object.assign(sv.features, newServerTab('', 'desc'))
  Object.assign(sv.psms, newServerTab('', 'asc'))
  featureCharge.value = ''
  featureQmax.value = ''
  featureMod.value = ''
  Object.assign(meta.runs, newMeta())
  Object.assign(meta.samples, newMeta())
  Object.assign(meta.ptms, newMeta())
  selectedProtein.value = ''
  proteinDetail.value = { loading: false, error: '', peptides: [] }
  sqlText.value = ''
  sqlResult.value = null
  sqlError.value = ''
  sqlInfo.value = ''
  schemaViews.value = []
  exampleBusy.value = ''
}

//: Start-page examples, by accession; the catalogue gives their current version, so
//: they describe what to look at, not numbers that a republish changes.
const START_EXAMPLES = [
  { accession: 'MSV000085836', title: 'CCLE cell lines', kind: 'TMT, fractionated',
    why: 'Many plexes: compare runs within a fraction and channels within a plex on the QC tab.' },
  { accession: 'PXD048538', title: 'Gastric cancer cell lines', kind: 'Label-free DIA',
    why: 'One sample per run: replicate consistency on the QC tab.' },
  { accession: 'PXD021013', title: 'ProteomeTools HLA peptides', kind: 'MSNet import · PSMs only',
    why: 'Peptide-level evidence: PSMs with scan, RT and PEP.' },
]

// Bumped on every dataset open; a response for an older open is dropped.
let loadGen = 0

async function loadRef() {
  const ref = refInput.value.trim()
  if (!ref) return
  const parts = ref.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    error.value = 'Dataset ref must look like "accession/phash", e.g. MSV000085836/8e4c044b513d.'
    loaded.value = false
    return
  }
  visibleRef.value = ref
  refInput.value = ref
  tab.value = 'overview'
  resetDerived()
  const gen = ++loadGen
  loading.value = true
  error.value = ''
  apiGet(DATASET_SEARCH_BASE, `/datasets/${encodeURIComponent(parts[0])}`, undefined, { retries: 0, timeout: 10000 })
    .then((d) => { if (gen === loadGen && d && d.accession) dsInfo.value = d })
    .catch(() => {})
  try {
    const ov = await qpxOverview(ref)
    if (gen !== loadGen) return
    overview.value = ov
    filesList.value = Object.values(ov.files || {}).flat()
    loaded.value = true
    const qtab = tabFromQuery(route.query)
    const wanted = tabs.find((t) => t.id === qtab)
    if (wanted && tabAvailable(wanted)) tab.value = qtab
    ensureTabData(tab.value)
  } catch (e) {
    if (gen !== loadGen) return
    loaded.value = false
    error.value = `Could not open dataset ${ref}: ${e.message || e}`
  } finally {
    if (gen === loadGen) loading.value = false
  }
}

// Columns worth a table column: not empty in every row, and not a copy of an
// earlier column (run_file_name repeats run_accession).
function informativeColumns(rows) {
  const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length)
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => rows.some((r) => !empty(r[k])))
  const same = (a, b) => rows.every((r) => JSON.stringify(r[a]) === JSON.stringify(r[b]))
  return keys.filter((k, i) => !keys.slice(0, i).some((p) => same(p, k)))
}

// Runs/samples: every page (the API caps a page at 500).
async function loadWhole(id, fetcher, key) {
  const ref = visibleRef.value
  const m = meta[id]
  m.loading = true
  m.error = ''
  try {
    const rows = []
    for (let offset = 0; offset < 10000; offset += 500) {
      const res = await fetcher(ref, { limit: 500, offset })
      if (ref !== visibleRef.value) return
      const page = res[key] || []
      rows.push(...page)
      if (page.length < 500) break
    }
    m.columns = informativeColumns(rows)
    m.rows = rows
  } catch (e) {
    if (ref !== visibleRef.value) return
    m.rows = []
    m.error = e.message || `could not load ${id}`
  } finally {
    if (ref === visibleRef.value) m.loading = false
  }
}

async function loadPtms() {
  const ref = visibleRef.value
  const m = meta.ptms
  m.loading = true
  m.error = ''
  try {
    const res = await qpxPtms(ref, { limit: 200 })
    if (ref !== visibleRef.value) return
    m.rows = res.rows || []
    m.columns = res.columns || []
    m.source = res.source || ''
    m.table = res.table || ''
  } catch (e) {
    if (ref !== visibleRef.value) return
    m.rows = []
    m.error = e.message || 'could not load PTMs'
  } finally {
    if (ref === visibleRef.value) m.loading = false
  }
}

const FETCH = { proteins: qpxSearchProteins, peptides: qpxSearchPeptides, features: qpxSearchFeatures, psms: qpxPsms }
const seq = { proteins: 0, peptides: 0, features: 0, psms: 0 }

async function loadServer(id) {
  const ref = visibleRef.value
  if (!ref) return
  const st = sv[id]
  const mine = ++seq[id]
  const current = () => ref === visibleRef.value && mine === seq[id]
  const params = { q: st.q, limit: PAGE }
  if (st.sort.key) { params.sort = st.sort.key; params.dir = st.sort.dir }
  if (id === 'features') {
    if (featureCharge.value !== '' && featureCharge.value != null) params.charge = featureCharge.value
    if (featureQmax.value !== '' && featureQmax.value != null) params.qvalue_max = featureQmax.value
    if (featureMod.value) params.mod = featureMod.value
  }
  st.loading = true
  st.error = ''
  try {
    const res = await FETCH[id](ref, params)
    if (!current()) return
    st.rows = res.rows || []
    if ((res.columns || []).length) st.columns = res.columns
    st.error = res.error || ''
  } catch (e) {
    if (!current()) return
    st.rows = []
    st.error = e.message || 'request failed'
  } finally {
    if (current()) st.loading = false
  }
}

function resort(id, s) {
  sv[id].sort = { key: s.key, dir: s.dir }
  loadServer(id)
}

function showModFeatures(mod) {
  featureMod.value = mod
  const alreadyLoaded = tabLoaded.has(`${visibleRef.value}|features`)
  setTab('features')
  if (alreadyLoaded) loadServer('features')
}

// The builder only emits on user changes, so an example or hand-written SQL stays put until then.
function onBuilderSql(sql) {
  sqlText.value = sql
  sqlInfo.value = ''
}

async function loadSchema() {
  const ref = visibleRef.value
  if (!ref) return
  schemaLoading.value = true
  sqlError.value = ''
  try {
    const res = await qpxSchema(ref)
    if (ref !== visibleRef.value) return
    schemaViews.value = res.views || []
  } catch {
    if (ref !== visibleRef.value) return
    schemaViews.value = []
  } finally {
    if (ref === visibleRef.value) schemaLoading.value = false
  }
}

async function loadExample(ex) {
  if (!ex || exampleBusy.value) return
  exampleBusy.value = ex.id
  sqlText.value = ex.sql
  sqlResult.value = null
  sqlError.value = ''
  sqlInfo.value = `Loaded "${ex.title}" — edit and run.`
  await runSql()
  exampleBusy.value = ''
}

let sqlSeq = 0

async function runSql() {
  const ref = visibleRef.value
  const sql = sqlText.value
  if (!ref || !sql.trim()) return
  const mine = ++sqlSeq
  const current = () => ref === visibleRef.value && mine === sqlSeq
  sqlRunning.value = true
  sqlError.value = ''
  sqlInfo.value = ''
  try {
    const res = await qpxRunSql(ref, { sql, limit: sqlLimit.value || undefined })
    if (!current()) return
    sqlResult.value = res
  } catch (e) {
    if (!current()) return
    sqlResult.value = { error: e.message || 'query failed' }
  } finally {
    if (current()) sqlRunning.value = false
  }
}

async function openProtein(acc) {
  const ref = visibleRef.value
  const current = () => ref === visibleRef.value && acc === selectedProtein.value
  selectedProtein.value = acc
  proteinDetail.value = { loading: true, error: '', peptides: [] }
  await nextTick()
  if (detailEl.value && detailEl.value.scrollIntoView) detailEl.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  try {
    const [d, expr] = await Promise.all([
      qpxProtein(ref, acc),
      qpxProteinExpression(ref, acc),
    ])
    if (!current()) return
    proteinDetail.value = { loading: false, error: '', peptides: d.peptides || [], expr: expr || null }
  } catch (e) {
    if (!current()) return
    proteinDetail.value = { loading: false, error: e.message || 'failed', peptides: [] }
  }
}

// Switch tab AND keep the URL shareable: ?ref=…&tab=<id> (deep-linkable).
//: Each tab's data loads the first time the tab is opened (once per dataset), so
//: opening a dataset runs only the overview's queries instead of every tab's.
const TAB_LOADERS = {
  // the sample colouring needs the run and sample tables
  overview: () => { wholeOnce('runs'); wholeOnce('samples') },
  qc: () => { wholeOnce('runs'); wholeOnce('samples') },
  runs: () => wholeOnce('runs'),
  samples: () => wholeOnce('samples'),
  proteins: () => loadServer('proteins'),
  peptides: () => loadServer('peptides'),
  features: () => { loadServer('features'); ptmsOnce() },
  ptms: () => ptmsOnce(),
  psms: () => loadServer('psms'),
  queries: () => loadSchema(),
}
const tabLoaded = new Set()

// Runs and samples load once per dataset, whichever tab asks first.
const WHOLE = { runs: [qpxRuns, 'run'], samples: [qpxSamples, 'sample'] }
function wholeOnce(id) {
  const [fetcher, view] = WHOLE[id]
  const key = `${visibleRef.value}|whole:${id}`
  if (tabLoaded.has(key) || overview.value.available_views[view] === false) return
  tabLoaded.add(key)
  loadWhole(id, fetcher, id)
}

// Features (its PTM filter) and PTMs share one PTM list.
function ptmsOnce() {
  if (!meta.ptms.loading && !meta.ptms.rows.length && !meta.ptms.source) loadPtms()
}

function ensureTabData(id) {
  const key = `${visibleRef.value}|${id}`
  if (!TAB_LOADERS[id] || tabLoaded.has(key)) return
  tabLoaded.add(key)
  TAB_LOADERS[id]()
}

function setTab(id) {
  tab.value = id
  ensureTabData(id)
  const qtab = tabFromQuery(route.query)
  if (qtab !== id) {
    router.replace({ query: { ...route.query, tab: id } })
  }
}

// Deep-link helpers: ?ref=accession/phash (or ?dataset_ref=…) and ?tab=<id>.
function refFromQuery(q) {
  return (q && (q.ref || q.dataset_ref)) || ''
}

//: Old links used ?tab=spectra for the PSM tab.
const TAB_ALIASES = { spectra: 'psms' }

function tabFromQuery(q) {
  const raw = (q && q.tab) || ''
  const t = TAB_ALIASES[raw] || raw
  return tabs.some((tb) => tb.id === t) ? t : ''
}

onMounted(() => {
  const r = refFromQuery(route.query)
  if (r) {
    refInput.value = r
    loadRef()
  }
})

// Back to a URL without a ref (browser back, the Explorer link): show the start page.
function closeDataset() {
  loadGen++
  visibleRef.value = ''
  refInput.value = ''
  overview.value = null
  loaded.value = false
  loading.value = false
  error.value = ''
  resetDerived()
}

watch(() => route.query, (q) => {
  const r = refFromQuery(q)
  if (r && r !== visibleRef.value) {
    refInput.value = r
    loadRef()
  } else if (!r && visibleRef.value) {
    closeDataset()
  }
})
</script>

<style>
.qx-title { font-size: 28px; font-weight: 700; margin: 8px 0 4px; }
.qx-sub { color: var(--text-secondary); margin-bottom: 22px; }
.qx-doc-link { margin-left: 8px; font-size: 13px; }

.qx-picker { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
.qx-input {
  font-family: var(--mono);
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
  min-width: 320px;
}
.qx-input-sm { min-width: 60px; font-family: var(--mono); }
.qx-input-num { min-width: 0; width: 120px; }

.placeholder-empty { text-align: center; padding: 40px 12px; color: var(--text-muted); }

.qx-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.qx-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 14px 16px;
}
.qx-card-val { font-size: 22px; font-weight: 700; font-family: var(--mono); }
.qx-card-label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); margin-top: 2px; }
.qx-hint { color: var(--text-muted); font-size: 13px; margin-bottom: 14px; }

.qx-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--border); margin-bottom: 18px; flex-wrap: wrap; }
.qx-tab {
  padding: 8px 14px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
}
.qx-tab.active { color: var(--indigo); border-bottom-color: var(--indigo); }
.qx-tab:disabled { color: var(--text-muted); opacity: 0.45; cursor: not-allowed; }

.qx-tab-body { margin-top: 4px; }
.qx-section { font-size: 16px; font-weight: 600; margin: 18px 0 10px; }
.qx-dataset { display: flex; justify-content: space-between; gap: 12px 32px; flex-wrap: wrap; margin-bottom: 16px;
  padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.qx-dataset-main { min-width: 0; flex: 1 1 420px; }
.qx-dataset-ref { font-family: var(--mono); font-size: 13px; color: var(--text-muted); }
.qx-dataset-title { font-size: 18px; font-weight: 600; margin: 2px 0 6px; color: var(--text-primary); }
.qx-dataset-links { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 4px 0 0; font-size: 13px; }
.qx-dataset-version { margin: 6px 0 0; }
.qx-dataset-facts { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; margin: 0; font-size: 13px; flex: 0 1 420px; }
.qx-dataset-facts > div { display: contents; }
.qx-dataset-facts dt { color: var(--text-muted); }
.qx-dataset-facts dd { margin: 0; color: var(--text-primary); }
.qx-files { margin: 4px 0 14px; font-size: 13px; color: var(--text-secondary); }
.qx-files summary { cursor: pointer; margin-bottom: 6px; }
.qx-opening { max-width: 420px; margin: 40px auto; }
.qx-block-label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; }
.qx-file-list { margin: 0; padding-left: 18px; color: var(--text-secondary); font-family: var(--mono); font-size: 13px; }

.qx-prot-detail { margin-bottom: 20px; padding: 14px 16px; border: 1px solid var(--indigo); border-radius: 10px;
  background: rgba(26, 95, 180, 0.03); scroll-margin-top: 90px; }
.qx-detail-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.qx-mono { font-family: var(--mono); }
.qx-normal { text-transform: none; }
.qx-link { all: unset; cursor: pointer; color: var(--indigo); font-family: var(--mono); font-size: 13px; font-weight: 600; }
.qx-link:hover, .qx-link:focus-visible { text-decoration: underline; }
.qt-state-inline { color: var(--text-muted); padding: 8px 0; }

.qx-query-list { display: flex; flex-direction: column; gap: 8px; }
.qx-query-item {
  display: flex; flex-direction: column; gap: 2px; text-align: left;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface); cursor: pointer; font-size: 13px;
}
.qx-query-item.active { border-color: var(--indigo); background: rgba(26, 95, 180, 0.04); }

/* SQL editor */
.qx-builder { margin-bottom: 18px; padding: 12px 14px; border: 1px solid var(--border, rgba(0,0,0,0.1)); border-radius: 8px; }
.qx-sql {
  width: 100%; font-family: var(--mono); font-size: 13px; line-height: 1.5;
  padding: 12px; border: 1px solid var(--border); border-radius: 8px;
  background: #0b0e17; color: #d7e0ff; resize: vertical; box-sizing: border-box;
}
.qx-sql:focus { outline: none; border-color: var(--indigo); }
.qx-sql-hint { font-size: 12px; }
.qx-sql-result { margin-top: 4px; }

@media (max-width: 820px) {
  .qx-input { min-width: 100%; }
}
</style>
