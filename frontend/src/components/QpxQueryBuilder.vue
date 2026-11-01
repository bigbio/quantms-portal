<template>
  <div class="qb">
    <div class="qb-row">
      <label class="qb-label">Table</label>
      <select v-model="spec.table" class="qx-input qx-input-sm" data-test="qb-table" @change="resetForTable">
        <option v-for="v in views" :key="v.name" :value="v.name">{{ v.name }}</option>
      </select>
    </div>

    <div class="qb-row">
      <label class="qb-label">Columns</label>
      <template v-if="!grouped">
        <span v-for="c in spec.columns" :key="c" class="qb-chip">
          {{ c }} <button class="qb-x" :aria-label="`remove ${c}`" @click="remove(spec.columns, c)">✕</button>
        </span>
        <select class="qx-input qx-input-sm" data-test="qb-add-column" value="" @change="addFrom($event, spec.columns)">
          <option value="">{{ spec.columns.length ? '+ column' : 'all columns (+ pick)' }}</option>
          <option v-for="c in columnNames" :key="c" :value="c" :disabled="spec.columns.includes(c)">{{ c }}</option>
        </select>
      </template>
      <span v-else class="muted">the group-by columns and the summaries below</span>
    </div>

    <div class="qb-row qb-top">
      <label class="qb-label">Where</label>
      <div class="qb-stack">
        <div v-for="(f, i) in spec.filters" :key="i" class="qb-line" data-test="qb-filter">
          <select v-model="f.column" class="qx-input qx-input-sm" @change="f.op = opsFor(types[f.column])[0]; f.value = ''">
            <option v-for="c in columnNames" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="f.op" class="qx-input qx-input-sm">
            <option v-for="op in opsFor(types[f.column])" :key="op" :value="op">{{ op }}</option>
          </select>
          <input v-if="needsValue(f.op)" v-model="f.value" class="qx-input qx-input-sm" placeholder="value" />
          <button class="qb-x" aria-label="remove filter" @click="spec.filters.splice(i, 1)">✕</button>
        </div>
        <button class="page-btn qb-add" data-test="qb-add-filter" @click="addFilter">+ filter</button>
      </div>
    </div>

    <div class="qb-row">
      <label class="qb-label">Group by</label>
      <span v-for="c in spec.groupBy" :key="c" class="qb-chip">
        {{ c }} <button class="qb-x" :aria-label="`ungroup ${c}`" @click="remove(spec.groupBy, c)">✕</button>
      </span>
      <select class="qx-input qx-input-sm" data-test="qb-add-group" value="" @change="addFrom($event, spec.groupBy)">
        <option value="">+ group by</option>
        <option v-for="c in groupableNames" :key="c" :value="c" :disabled="spec.groupBy.includes(c)">{{ c }}</option>
      </select>
    </div>

    <div class="qb-row qb-top">
      <label class="qb-label">Summaries</label>
      <div class="qb-stack">
        <div v-for="(a, i) in spec.aggregates" :key="i" class="qb-line" data-test="qb-agg">
          <select v-model="a.fn" class="qx-input qx-input-sm" @change="onAggFn(a)">
            <option v-for="fn in AGGREGATES" :key="fn" :value="fn">{{ fn }}</option>
          </select>
          <select v-if="a.fn !== 'count'" v-model="a.column" class="qx-input qx-input-sm">
            <option v-for="c in numericNames" :key="c" :value="c">{{ c }}</option>
          </select>
          <span v-else class="muted">rows</span>
          <button class="qb-x" aria-label="remove summary" @click="spec.aggregates.splice(i, 1)">✕</button>
        </div>
        <button class="page-btn qb-add" data-test="qb-add-agg" @click="spec.aggregates.push({ fn: 'count', column: '' })">+ summary</button>
      </div>
    </div>

    <div class="qb-row">
      <label class="qb-label">Sort</label>
      <select v-model="spec.orderBy.column" class="qx-input qx-input-sm" data-test="qb-order">
        <option value="">none</option>
        <option v-for="c in outputNames" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="spec.orderBy.dir" class="qx-input qx-input-sm" :disabled="!spec.orderBy.column">
        <option value="desc">descending</option>
        <option value="asc">ascending</option>
      </select>
      <label class="qb-label qb-label-inline">Limit</label>
      <input v-model.number="spec.limit" type="number" min="1" :max="MAX_LIMIT" class="qx-input qx-input-sm qb-limit" />
    </div>

    <ul v-if="problems.length" class="qb-problems">
      <li v-for="p in problems" :key="p">{{ p }}</li>
    </ul>
  </div>
</template>

<script setup>
// Filter builder over one qpx view; emits the generated SQL on every change.
import { computed, reactive, watch } from 'vue'
import { AGGREGATES, MAX_LIMIT, aggAlias, buildSql, needsValue, opsFor, typeClass } from '../qpxQueryBuilder.js'

const props = defineProps({
  // [{ name, columns: [{ name, type }] }] from GET /schema
  views: { type: Array, required: true },
})
const emit = defineEmits(['sql'])

const spec = reactive({
  table: props.views[0]?.name || '',
  columns: [],
  filters: [],
  groupBy: [],
  aggregates: [],
  orderBy: { column: '', dir: 'desc' },
  limit: 50,
})

const types = computed(() => {
  const view = props.views.find((v) => v.name === spec.table)
  return Object.fromEntries((view?.columns || []).map((c) => [c.name, c.type]))
})
const columnNames = computed(() => Object.keys(types.value))
const numericNames = computed(() => columnNames.value.filter((c) => typeClass(types.value[c]) === 'number'))
const groupableNames = computed(() => columnNames.value.filter((c) => typeClass(types.value[c]) !== 'other'))
const grouped = computed(() => spec.groupBy.length > 0 || spec.aggregates.length > 0)
const outputNames = computed(() => {
  if (!grouped.value) return spec.columns.length ? spec.columns : columnNames.value
  const aggs = spec.aggregates.length ? spec.aggregates : [{ fn: 'count' }]
  return [...spec.groupBy, ...aggs.map(aggAlias)]
})

const built = computed(() => buildSql(spec, types.value))
const problems = computed(() => built.value.problems.filter((p) => p !== 'choose a table'))

watch(built, (b, old) => { if (old && b.sql !== old.sql) emit('sql', b.sql) })

watch(() => props.views, (views) => {
  if (!views.some((v) => v.name === spec.table)) {
    spec.table = views[0]?.name || ''
    resetForTable()
  }
})

function resetForTable() {
  spec.columns = []
  spec.filters = []
  spec.groupBy = []
  spec.aggregates = []
  spec.orderBy = { column: '', dir: 'desc' }
}

function addFrom(event, list) {
  const value = event.target.value
  if (value && !list.includes(value)) list.push(value)
  event.target.value = ''
}

function remove(list, value) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
}

function onAggFn(agg) {
  if (agg.fn !== 'count' && !numericNames.value.includes(agg.column)) agg.column = numericNames.value[0] || ''
}

function addFilter() {
  const column = columnNames.value[0]
  if (column) spec.filters.push({ column, op: opsFor(types.value[column])[0], value: '' })
}
</script>

<style scoped>
.qb { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.qb-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.qb-top { align-items: flex-start; }
.qb-label { width: 84px; flex: none; font-size: 0.85em; color: var(--text-muted, #666); }
.qb-label-inline { width: auto; margin-left: 12px; }
.qb-stack { display: flex; flex-direction: column; gap: 6px; }
.qb-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.qb-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px;
  background: rgba(26, 95, 180, 0.1); font-size: 0.85em; }
.qb-x { border: none; background: none; cursor: pointer; color: inherit; opacity: 0.6; padding: 0 2px; }
.qb-x:hover { opacity: 1; }
.qb-add { align-self: flex-start; padding: 2px 10px; font-size: 0.85em; }
.qb-limit { width: 80px; }
.qb-problems { margin: 0; padding-left: 100px; color: #b45309; font-size: 0.85em; }
@media (max-width: 600px) {
  .qb-label { width: 100%; }
  .qb-problems { padding-left: 16px; }
}
</style>
