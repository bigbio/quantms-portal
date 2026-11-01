<template>
  <div>
    <div class="cl-toolbar">
      <div class="cl-toggle" role="group" aria-label="Compare mode">
        <button type="button" :class="{ active: mode === 'lines' }" :aria-pressed="mode === 'lines'" @click="setMode('lines')">Cell lines</button>
        <button type="button" :class="{ active: mode === 'groups' }" :aria-pressed="mode === 'groups'" @click="setMode('groups')">Lineages / diseases</button>
      </div>
    </div>

    <template v-if="mode === 'lines'">
      <section class="cl-card">
        <div class="cl-compare-pick">
          <AtlasPicker v-if="lines.length < maxLines" id="cl-compare-line" kind="line" :label="`Add a cell line (${lines.length}/${maxLines})`"
                       placeholder="e.g. MCF7, A549, CVCL_0023" @select="addLine" />
          <div class="cl-chips">
            <span v-for="l in lines" :key="l" class="cl-chip">
              {{ lineNames[l] || l }}
              <button type="button" class="cl-chip-x" :aria-label="`Remove ${lineNames[l] || l}`" @click="removeLine(l)">&times;</button>
            </span>
          </div>
        </div>
        <p v-if="lines.length < 2" class="cl-muted">Pick 2 to {{ maxLines }} lines to compare: type a name, or tick them in the list below.</p>
      </section>
      <details class="cl-card cl-browse" :open="lines.length < 2" data-test="compare-browse">
        <summary>Pick cell lines from the list<span class="cl-muted"> · filter by lineage, cancer type or acquisition</span></summary>
        <LineBrowser selectable :selected="lines" :max="maxLines" @toggle="toggleLine" @open="(l) => $emit('select-line', l)" />
      </details>
      <StatusBlock :loading="req.loading.value" :error="req.error.value" what="This comparison" :retry="load" />
      <section v-if="lineResult" class="cl-card">
        <div class="cl-card-head">
          <h3>Largest differences between the selected cell lines</h3>
          <label class="cl-ctl-inline"><input v-model="reproducibleOnly" type="checkbox" data-test="compare-reproducible" /> reproducible proteins only</label>
        </div>
        <div v-if="!lineResult.genes?.length" class="cl-empty">No protein has an amount in all selected lines<template v-if="reproducibleOnly"> among reproducible proteins</template>.</div>
        <div v-else class="cl-table-wrap">
          <table class="cl-table" data-test="compare-lines-table">
            <thead>
              <tr><th>Gene</th><th v-for="l in lineResult.lines" :key="l.line" class="num">{{ l.name || l.line }}</th><th class="num">Spread (log2)</th><th>Between labs</th></tr>
            </thead>
            <tbody>
              <tr v-for="g in lineResult.genes" :key="g.gene">
                <td><button type="button" class="cl-linkish" @click="$emit('select-gene', g.gene)">{{ g.gene }}</button></td>
                <td v-for="l in lineResult.lines" :key="l.line" class="num cl-cmp-cell" data-test="compare-cell"
                    :style="{ background: amountColor(g.amount[l.line]), color: Math.abs(g.amount[l.line]) > 2.5 ? '#ffffff' : 'inherit' }"
                    :title="`${g.gene} in ${l.name || l.line}: ${signed(g.amount[l.line])} log2${g.detected[l.line] ? ', detected' : ', not detected'}`">
                  <span class="cl-cmp-det" :class="{ on: g.detected[l.line] }"></span>{{ signed(g.amount[l.line]) }}
                </td>
                <td class="num">{{ fmt(g.spread) }}</td>
                <td><span class="cl-pill" :style="relStyle(g.reliability_class)">{{ g.reliability_class || 'not scored' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="cl-caption">Each value is the line's amount: log2 difference from the average cell line of its studies (0 = average, +1 = twice), averaged over its studies; ● = detected in that line. Lines need not share a study, so differences include lab effects; "reproducible proteins only" keeps proteins whose cell-line differences reproduce between labs.</p>
      </section>
    </template>

    <template v-else>
      <section class="cl-card">
        <div class="cl-compare-groups">
          <label class="cl-ctl">
            <span class="cl-ctl-label">Group by</span>
            <select :value="group" aria-label="Group by" @change="update({ group: $event.target.value, a: '', b: '' })">
              <option v-for="k in GROUP_KINDS" :key="k.id" :value="k.id">{{ k.label }}</option>
            </select>
          </label>
          <label class="cl-ctl">
            <span class="cl-ctl-label">A</span>
            <select :value="a" aria-label="Group A" @change="update({ a: $event.target.value })">
              <option value="">Choose…</option>
              <option v-for="o in options" :key="o.value" :value="o.value">{{ o.value }} ({{ o.n_lines }})</option>
            </select>
          </label>
          <label class="cl-ctl">
            <span class="cl-ctl-label">B</span>
            <select :value="b" aria-label="Group B" @change="update({ b: $event.target.value })">
              <option value="">Choose…</option>
              <option v-for="o in options" :key="o.value" :value="o.value">{{ o.value }} ({{ o.n_lines }})</option>
            </select>
          </label>
        </div>
        <p v-if="a && a === b" class="cl-muted">Pick two different groups.</p>
      </section>
      <StatusBlock :loading="req.loading.value" :error="req.error.value" what="This comparison" :retry="load" />
      <template v-if="groupResult">
        <p class="cl-caption cl-warn" data-test="compare-caption">Differences are computed within each study, between lines measured together, then combined across studies (A49); descriptive, not a statistical test.</p>
        <div v-if="!groupResult.genes?.length" class="cl-empty">No genes are measured in both groups.</div>
        <template v-else>
          <section class="cl-card">
            <div class="cl-card-head">
              <h3>{{ groupResult.a }} vs {{ groupResult.b }}</h3>
              <span class="cl-legend">
                <span class="cl-legend-item"><span class="cl-swatch cl-bg-grey"></span>all genes ({{ groupResult.background?.length ?? 0 }})</span>
                <span class="cl-legend-item"><span class="cl-swatch" :style="{ background: GROUP_A }"></span>higher in {{ groupResult.a }} ({{ nHigher.a }})</span>
                <span class="cl-legend-item"><span class="cl-swatch" :style="{ background: GROUP_B }"></span>higher in {{ groupResult.b }} ({{ nHigher.b }})</span>
                <span class="cl-legend-item"><span class="cl-line-swatch cl-diag-bg"></span> x = y</span>
              </span>
            </div>
            <ScatterChart :data="groupScatter" :options="groupOptions" :height="420" @point-click="(p) => p.label && $emit('select-gene', p.label)" />
          </section>
          <section class="cl-card">
            <div class="cl-table-wrap cl-table-tall">
              <table class="cl-table" data-test="compare-groups-table">
                <thead>
                  <tr><th>Gene</th><th class="num">Δ</th><th class="num">Mean A</th><th class="num">Mean B</th><th class="num">Studies</th><th class="num">Lines A/B</th><th class="num">Detected A/B</th><th>Reliability</th></tr>
                </thead>
                <tbody>
                  <tr v-for="g in groupResult.genes" :key="g.gene">
                    <td>
                      <button type="button" class="cl-linkish" @click="$emit('select-gene', g.gene)">{{ g.gene }}</button>
                      <span v-if="g.is_family" class="cl-flag" title="family row">F</span>
                      <span v-if="g.contamination_prone" class="cl-flag cl-flag-warn" title="contamination-prone">C</span>
                    </td>
                    <td class="num" :class="g.delta >= 0 ? 'cl-pos' : 'cl-neg'">{{ fmt(g.delta) }}</td>
                    <td class="num">{{ fmt(g.mean_a) }}</td>
                    <td class="num">{{ fmt(g.mean_b) }}</td>
                    <td class="num">{{ g.n_studies_compared ?? '—' }}</td>
                    <td class="num cl-nowrap">{{ g.n_lines_a ?? '—' }} / {{ g.n_lines_b ?? '—' }}</td>
                    <td class="num cl-nowrap">{{ pct(g.frac_detected_a) }} / {{ pct(g.frac_detected_b) }}</td>
                    <td>{{ g.reliability_class || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ScatterChart from '../ScatterChart.vue'
import AtlasPicker from './AtlasPicker.vue'
import StatusBlock from './StatusBlock.vue'
import { useRequest } from './useRequest.js'
import LineBrowser from './LineBrowser.vue'
import {
  rule, GROUP_KINDS, compare, compareParams, fmt, pct, signed, amountColor, reliabilityStyle,
} from '../../cellLines.js'
import { CATEGORICAL } from '../../utils/chartColors.js'

const props = defineProps({
  mode: { type: String, default: 'lines' },
  lines: { type: Array, default: () => [] },
  group: { type: String, default: 'lineage' },
  a: { type: String, default: '' },
  b: { type: String, default: '' },
  groups: { type: Array, default: () => [] },
  manifest: { type: Object, default: null },
})
const emit = defineEmits(['update', 'select-gene', 'select-line'])

const req = useRequest(compare)
const reproducibleOnly = ref(true)
const maxLines = computed(() => rule(props.manifest, 'max_compare_lines'))
const selection = computed(() => ({ mode: props.mode, lines: props.lines, group: props.group, a: props.a, b: props.b,
  reproducibleOnly: reproducibleOnly.value, maxLines: maxLines.value }))
const paramsKey = computed(() => JSON.stringify(compareParams(selection.value)))

// DuckDB MAP columns may arrive as {key: [...], value: [...]} instead of a plain object.
function toMap(m) {
  if (m && Array.isArray(m.key) && Array.isArray(m.value)) return Object.fromEntries(m.key.map((k, i) => [k, m.value[i]]))
  return m || {}
}
const lineResult = computed(() => {
  const r = req.data.value
  if (!r || props.mode !== 'lines' || !r.lines) return null
  const order = new Map(props.lines.map((l, i) => [l, i]))
  const lines = [...r.lines].sort((x, y) => (order.get(x.line) ?? 99) - (order.get(y.line) ?? 99))
  return { lines, genes: (r.genes || []).map((g) => ({ ...g, amount: toMap(g.amount), detected: toMap(g.detected) })) }
})
const picked = ref({})
const lineNames = computed(() => ({ ...picked.value, ...Object.fromEntries((req.data.value?.lines || []).map((l) => [l.line, l.name])) }))
const groupResult = computed(() => (props.mode === 'groups' && req.data.value?.group ? req.data.value : null))

const options = computed(() => props.groups.filter((g) => g.group === props.group))
// The largest differences take the colour of the group they are higher in; two
// fixed palette slots, since hashed lineage hues of two groups can come out alike.
const [GROUP_A, GROUP_B] = CATEGORICAL
const nHigher = computed(() => {
  const genes = groupResult.value?.genes || []
  return { a: genes.filter((g) => g.mean_a > g.mean_b).length, b: genes.filter((g) => g.mean_b > g.mean_a).length }
})
const groupScatter = computed(() => ({
  datasets: [
    {
      label: 'largest differences', order: 0,
      data: (groupResult.value?.genes || []).map((g) => ({ x: g.mean_a, y: g.mean_b, label: g.gene })),
      backgroundColor: (groupResult.value?.genes || []).map((g) => (g.mean_a > g.mean_b ? GROUP_A : GROUP_B)),
      pointRadius: 3, pointHoverRadius: 5,
    },
    {
      label: 'x = y', order: 1, data: [{ x: 0, y: 0 }, { x: 1, y: 1 }], showLine: true,
      borderColor: 'rgba(100, 116, 139, 0.7)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, pointHitRadius: 0,
    },
    {
      label: 'all genes', order: 2,
      data: (groupResult.value?.background || []).map(([gene, x, y]) => ({ x, y, label: gene })),
      backgroundColor: 'rgba(148, 163, 184, 0.35)', pointRadius: 1.5, pointHoverRadius: 3,
    },
  ],
}))
const groupOptions = computed(() => ({
  plugins: {
    legend: { display: false },
    tooltip: { filter: (ctx) => !!ctx.raw.label, callbacks: { label: (ctx) => `${ctx.raw.label}: ${fmt(ctx.raw.x)} vs ${fmt(ctx.raw.y)}` } },
  },
  scales: {
    x: { min: 0, max: 1, title: { display: true, text: `${props.a}: mean within-study rank` } },
    y: { min: 0, max: 1, title: { display: true, text: `${props.b}: mean within-study rank` } },
  },
}))

const relStyle = (c) => {
  const s = reliabilityStyle(c || 'not scored')
  return { color: s.fg, background: s.bg }
}
const update = (patch) => emit('update', patch)
function setMode(mode) { if (mode !== props.mode) update({ mode }) }
function addLine(line, item) {
  if (item?.name) picked.value = { ...picked.value, [line]: item.name }
  if (!props.lines.includes(line)) update({ lines: [...props.lines, line].slice(0, maxLines.value) })
}
function removeLine(line) { update({ lines: props.lines.filter((l) => l !== line) }) }
function toggleLine(line, row) { if (props.lines.includes(line)) removeLine(line); else addLine(line, row) }

function load() {
  if (compareParams(selection.value)) req.run(selection.value)
  else req.reset()
}
watch(paramsKey, load, { immediate: true })
</script>
