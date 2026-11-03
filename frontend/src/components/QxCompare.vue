<template>
  <section class="cmp">
    <p class="qx-hint">
      Pick two groups of samples by an annotation. Each protein quantified in at least {{ MIN_GROUP }} samples of
      both groups gets Welch’s t-test on the observed values (no imputation), with Benjamini–Hochberg adjustment over the
      proteins tested. {{ designNote(design) }}
    </p>

    <div class="cmp-form">
      <label>
        Annotation
        <select v-model="field" @change="resetGroups">
          <option v-for="f in fields" :key="f.key" :value="f.key">{{ f.title }}</option>
        </select>
      </label>
      <label>
        Group A
        <select v-model="groupA">
          <option v-for="v in values" :key="v.label" :value="v.label" :disabled="v.label === groupB">{{ v.label }} ({{ v.n }})</option>
        </select>
      </label>
      <span class="cmp-vs">vs</span>
      <label>
        Group B
        <select v-model="groupB">
          <option :value="REST">All other samples ({{ restCount }})</option>
          <option v-for="v in values" :key="v.label" :value="v.label" :disabled="v.label === groupA">{{ v.label }} ({{ v.n }})</option>
        </select>
      </label>
      <button class="page-btn primary" :disabled="!canRun || state.loading" @click="run">
        {{ state.loading ? 'Comparing…' : 'Compare' }}
      </button>
    </div>
    <p v-if="!canRun && field" class="qx-hint">Each group needs at least {{ MIN_GROUP }} samples.</p>

    <QxProgress v-if="state.loading" label="Summarising every protein in both groups…" class="cmp-progress" />
    <p v-else-if="state.error" class="notice">{{ state.error }}</p>
    <template v-else-if="result">
      <div class="cmp-head">
        <p class="cmp-summary">
          <strong>{{ result.a.label }}</strong> ({{ result.a.n }} samples) vs <strong>{{ result.b.label }}</strong> ({{ result.b.n }}):
          {{ result.tested.length.toLocaleString() }} proteins tested;
          <span class="cmp-up">{{ nUp.toLocaleString() }} higher in A</span> and
          <span class="cmp-down">{{ nDown.toLocaleString() }} higher in B</span>
          at adjusted p &lt; {{ alpha }} and |log2 fold change| ≥ {{ minFc }}.
          {{ result.onlyA.length.toLocaleString() }} are quantified only in A and {{ result.onlyB.length.toLocaleString() }} only in B;
          {{ result.untested.toLocaleString() }} have too few values to test.
        </p>
        <div class="cmp-tools">
          <label>adj. p &lt;
            <select v-model.number="alpha"><option v-for="a in [0.01, 0.05, 0.1]" :key="a" :value="a">{{ a }}</option></select>
          </label>
          <label>|log2 FC| ≥
            <select v-model.number="minFc"><option v-for="f in [0, 0.5, 1, 2]" :key="f" :value="f">{{ f }}</option></select>
          </label>
          <QxExport :name="`${fileStem}-compare`" :png="() => volcanoEl" :csv="resultCsv" />
        </div>
      </div>
      <p class="cmp-note">log2 fold change = mean of A − mean of B. Click a point or a protein to open it.</p>
      <div ref="volcanoEl" class="cmp-volcano">
        <VolcanoPlot :rows="volcanoRows" :labels="{ up: `Higher in ${result.a.label}`, down: `Higher in ${result.b.label}` }" @select="(p) => $emit('open-protein', p)" />
      </div>

      <div class="qx-block-label cmp-label">Proteins by p-value<span v-if="result.tested.length > SHOWN" class="muted qx-normal"> · top {{ SHOWN }} shown, all in the CSV</span></div>
      <QxTable :columns="testedColumns" :rows="testedRows" sort-key="p_value" sort-dir="asc" row-key="protein" empty-text="No protein could be tested.">
        <template #cell="{ column, value, text }">
          <button v-if="column === 'protein'" class="qx-link" @click="$emit('open-protein', value)">{{ text }}</button>
          <template v-else>{{ text }}</template>
        </template>
      </QxTable>

      <div class="cmp-only">
        <div v-for="side in onlySides" :key="side.key">
          <div class="qx-block-label cmp-label">Only in {{ side.label }} ({{ side.rows.length.toLocaleString() }})</div>
          <QxTable :columns="side.columns" :rows="side.rows.slice(0, 50)" :empty-text="`No protein is quantified only in ${side.label}.`">
            <template #cell="{ column, value, text }">
              <button v-if="column === 'protein'" class="qx-link" @click="$emit('open-protein', value)">{{ text }}</button>
              <template v-else>{{ text }}</template>
            </template>
          </QxTable>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
// Group comparison: two groups of samples picked by an annotation, a Welch test
// per protein, a volcano plot and the ranked proteins. The choice lives in the
// URL (?cf=field&ca=A&cb=B, written by the page on `query`) so a comparison can be
// shared, and runs on opening.
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import QxExport from './QxExport.vue'
import QxProgress from './QxProgress.vue'
import QxTable from './QxTable.vue'
import VolcanoPlot from './VolcanoPlot.vue'
import { qpxAnalysisSql, qpxProteinNames } from '../qpx.js'
import { compareGroups, compareSql, designNote, isReference, MIN_GROUP } from '../qpxAnalysis.js'
import { annotation } from '../sampleColors.js'

const props = defineProps({
  datasetRef: { type: String, required: true },
  design: { type: Object, required: true },
  samples: { type: Array, required: true },
  // the annotations samples can be grouped by: [{ key, title }]
  fields: { type: Array, required: true },
  // the annotation the page is coloured by, the first choice
  preferred: { type: String, default: '' },
})
const emit = defineEmits(['open-protein', 'query'])

const REST = '\u0000rest'
const SHOWN = 200

const route = useRoute()
const fileStem = computed(() => props.datasetRef.replace('/', '_'))

const analysed = computed(() => props.samples.filter((s) => !isReference(s)))
const field = ref('')
const groupA = ref('')
const groupB = ref(REST)

const values = computed(() => {
  const counts = new Map()
  for (const s of analysed.value) {
    const v = annotation(s, field.value)
    if (v != null) counts.set(v, (counts.get(v) || 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, n]) => ({ label, n }))
})
const members = (v) => analysed.value.filter((s) => annotation(s, field.value) === v).map((s) => s.sample_accession)
const restCount = computed(() => analysed.value.length - (values.value.find((v) => v.label === groupA.value)?.n || 0))
const sizeOf = (g) => (g === REST ? restCount.value : values.value.find((v) => v.label === g)?.n || 0)
const canRun = computed(() => !!groupA.value && sizeOf(groupA.value) >= MIN_GROUP && sizeOf(groupB.value) >= MIN_GROUP)

// The URL's comparison if it names one, else the two largest groups of the preferred field.
function pickDefaults() {
  const q = route.query
  const keys = props.fields.map((f) => f.key)
  field.value = keys.includes(q.cf) ? q.cf : keys.includes(props.preferred) ? props.preferred : keys[0] || ''
  const labels = values.value.map((v) => v.label)
  const fromUrl = keys.includes(q.cf) && labels.includes(q.ca)
  if (!fromUrl) {
    resetGroups()
    return false
  }
  groupA.value = q.ca
  groupB.value = labels.includes(q.cb) && q.cb !== q.ca ? q.cb : REST
  return true
}
function resetGroups() {
  const labels = values.value.map((v) => v.label)
  groupA.value = labels[0] || ''
  groupB.value = labels.length > 1 ? labels[1] : REST
}

const state = ref({ loading: false, error: '' })
// shallow: thousands of rows, replaced whole
const result = shallowRef(null)
const alpha = ref(0.05)
const minFc = ref(1)
let seq = 0

async function run() {
  const r = props.datasetRef
  const mine = ++seq
  const a = { label: groupA.value, samples: members(groupA.value) }
  const b = groupB.value === REST
    ? { label: 'all other samples', samples: analysed.value.map((s) => s.sample_accession).filter((s) => !a.samples.includes(s)) }
    : { label: groupB.value, samples: members(groupB.value) }
  emit('query', { cf: field.value, ca: groupA.value, cb: groupB.value === REST ? 'rest' : groupB.value })
  state.value = { loading: true, error: '' }
  try {
    const [d, names] = await Promise.all([qpxAnalysisSql(r, compareSql(props.design, a.samples, b.samples)), qpxProteinNames(r)])
    if (mine !== seq) return
    const res = compareGroups(d.rows)
    for (const list of [res.tested, res.onlyA, res.onlyB]) for (const row of list) row.name = names.get(row.protein) ?? null
    result.value = { ...res, a: { label: a.label, n: a.samples.length }, b: { label: b.label, n: b.samples.length } }
    state.value = { loading: false, error: '' }
  } catch (e) {
    if (mine !== seq) return
    state.value = { loading: false, error: e.message || 'the comparison failed' }
  }
}

watch(() => [props.datasetRef, props.fields.map((f) => f.key).join()], () => {
  result.value = null
  if (pickDefaults() && canRun.value) run()
}, { immediate: true })

const significant = (r) => r.adj_pvalue < alpha.value && Math.abs(r.log2fc) >= minFc.value
const nUp = computed(() => result.value.tested.filter((r) => significant(r) && r.log2fc > 0).length)
const nDown = computed(() => result.value.tested.filter((r) => significant(r) && r.log2fc < 0).length)
const volcanoRows = computed(() => result.value.tested.map((r) => ({ protein: r.protein, log2fc: r.log2fc, adj_pvalue: r.adj_pvalue, significant: significant(r) })))
const testedRows = computed(() => result.value.tested.slice(0, SHOWN))
// n and mean columns named after the groups
const groupColumn = (key, side) => ({ key, label: `${key.startsWith('n_') ? 'n' : 'Mean'} ${result.value[side].label}` })
const testedColumns = computed(() => ['protein', 'name', 'log2fc', 'p_value', 'adj_pvalue',
  groupColumn('n_a', 'a'), groupColumn('n_b', 'b'), groupColumn('mean_a', 'a'), groupColumn('mean_b', 'b')])
const volcanoEl = ref(null)

const onlySides = computed(() => [
  { key: 'a', label: result.value.a.label, rows: result.value.onlyA, columns: ['protein', 'name', groupColumn('n_a', 'a'), groupColumn('mean_a', 'a')] },
  { key: 'b', label: result.value.b.label, rows: result.value.onlyB, columns: ['protein', 'name', groupColumn('n_b', 'b'), groupColumn('mean_b', 'b')] },
])

function resultCsv() {
  const res = result.value
  const columns = ['protein', 'name', 'status', 'log2fc', 't', 'df', 'p_value', 'adj_pvalue', 'n_a', 'n_b', 'mean_a', 'mean_b']
  const rows = [
    ...res.tested.map((r) => ({ ...r, status: 'tested' })),
    ...res.onlyA.map((r) => ({ ...r, status: `only in ${res.a.label}` })),
    ...res.onlyB.map((r) => ({ ...r, status: `only in ${res.b.label}` })),
  ]
  return { columns, rows }
}
</script>

<style scoped>
.cmp-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 14px; margin: 4px 0 12px; }
.cmp-form label, .cmp-tools label { display: inline-flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.cmp-tools label { flex-direction: row; align-items: center; gap: 6px; }
.cmp-form select, .cmp-tools select { font: inherit; font-size: 13px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface); color: var(--text-primary); max-width: 260px; }
.cmp-vs { padding-bottom: 7px; color: var(--text-muted); font-size: 13px; }
.cmp-progress { max-width: 420px; margin: 18px 0; }
.cmp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px 20px; flex-wrap: wrap; margin-top: 8px; }
.cmp-summary { margin: 0; font-size: 13px; color: var(--text-secondary); max-width: 760px; }
.cmp-up { color: var(--reg-up); font-weight: 600; }
.cmp-down { color: var(--reg-down); font-weight: 600; }
.cmp-tools { display: inline-flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.cmp-note { margin: 6px 0 8px; font-size: 12px; color: var(--text-muted); }
.cmp-volcano { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 10px; margin-bottom: 16px; }
.cmp-label { margin-top: 14px; }
.cmp-only { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
</style>
