<template>
  <section class="section glance" aria-labelledby="glance-title">
    <div class="container">
      <div class="section-header">
        <h2 id="glance-title">The data at a glance</h2>
        <p>
          Datasets, organisms and the charts count the portal catalogue; proteins, peptides and peptidoforms
          are distinct sequences in the search index<span v-if="generated">, updated {{ generated }}</span>.
          <router-link to="/statistics">All statistics →</router-link>
        </p>
      </div>

      <dl class="glance-kpis">
        <div v-for="k in kpis" :key="k.label" class="glance-kpi">
          <dt>{{ k.label }}</dt>
          <dd :title="k.full">{{ k.display }}</dd>
        </div>
      </dl>

      <div v-if="panels.length" class="glance-panels">
        <figure v-for="panel in panels" :key="panel.title" class="glance-panel">
          <figcaption>{{ panel.title }}</figcaption>
          <ol class="hbars">
            <li v-for="row in panel.rows" :key="row.label" :title="`${row.label}: ${row.value} datasets`">
              <span class="hbar-label">{{ row.label }}</span>
              <span class="hbar-track"><span class="hbar-fill" :style="{ width: `${Math.max(row.share * 100, 1.5)}%` }"></span></span>
              <span class="hbar-value">{{ row.value }}</span>
            </li>
          </ol>
        </figure>
      </div>
      <p v-else-if="catalogueError" class="glance-note">The breakdowns are temporarily unavailable.</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiGet } from '../../api.js'
import { BROWSE_BASE, STATS_PATH, DATASET_SEARCH_BASE } from '../../config.js'
import { formatBig } from '../../utils/format.js'
import { barRows, catalogueBreakdowns } from '../../utils/homeData.js'

// Catalogue collections (name, title, dataset_count), already loaded by the home page.
const props = defineProps({
  collections: { type: Array, default: () => [] },
})

const stats = ref(null)
const catalogue = ref(null)
const catalogueError = ref(false)

const generated = computed(() => {
  const iso = stats.value?.generated_at
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
})

function kpi(label, n) {
  return { label, display: typeof n === 'number' ? formatBig(n) : '—', full: typeof n === 'number' ? n.toLocaleString('en-US') : '' }
}

const kpis = computed(() => {
  const k = stats.value?.kpis || {}
  const cols = props.collections.filter((c) => c.dataset_count > 0)
  return [
    kpi('Datasets', cols.length ? cols.reduce((s, c) => s + c.dataset_count, 0) : undefined),
    kpi('Collections', cols.length || undefined),
    kpi('Proteins', k.proteins),
    kpi('Peptides', k.peptides),
    kpi('Peptidoforms', k.peptidoforms),
    kpi('Organisms', breakdowns.value?.nOrganisms),
  ]
})

const breakdowns = computed(() => (catalogue.value ? catalogueBreakdowns(catalogue.value) : null))

const panels = computed(() => {
  const out = []
  const cols = props.collections.filter((c) => c.dataset_count > 0)
  if (cols.length) {
    out.push({
      title: 'Datasets per collection',
      rows: barRows(cols.map((c) => ({ label: c.title, datasets: c.dataset_count })), 'label'),
    })
  }
  const b = breakdowns.value
  if (b) {
    out.push({ title: 'Datasets per organism', rows: b.organisms })
    out.push({ title: 'Datasets per tissue', rows: b.tissues })
    out.push({ title: 'Datasets per instrument', rows: b.instruments })
  }
  return out.filter((p) => p.rows.length)
})

async function loadCatalogue() {
  const all = []
  for (let page = 1; ; page++) {
    const res = await apiGet(DATASET_SEARCH_BASE, '/datasets', { page_size: 200, page })
    all.push(...(res.datasets || []))
    if (page >= (res.total_pages || 1)) break
  }
  return all
}

onMounted(() => {
  apiGet(BROWSE_BASE, STATS_PATH, null, { retries: 1 }).then((s) => { stats.value = s }).catch(() => {})
  loadCatalogue().then((d) => { catalogue.value = d }).catch(() => { catalogueError.value = true })
})
</script>

<style scoped>
.glance-kpis {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  margin-bottom: 32px;
}
.glance-kpi {
  padding: 16px 18px;
  border-left: 1px solid var(--border-subtle);
}
.glance-kpi:first-child {
  border-left: 0;
  padding-left: 0;
}
.glance-kpi dt {
  font-size: 13px;
  color: var(--text-muted);
}
.glance-kpi dd {
  font-size: 30px;
  font-weight: 600;
  color: var(--brand-deep);
  line-height: 1.2;
}
.glance-panels {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 32px;
}
.glance-panel figcaption {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}
.hbars {
  list-style: none;
}
.hbars li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  grid-template-areas: 'label value' 'track track';
  column-gap: 8px;
  margin-bottom: 9px;
  font-size: 13px;
}
.hbar-label {
  grid-area: label;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hbar-value {
  grid-area: value;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  font-weight: 500;
}
.hbar-track {
  grid-area: track;
  height: 8px;
  margin-top: 3px;
}
.hbar-fill {
  display: block;
  height: 100%;
  background: var(--brand);
  border-radius: 0 4px 4px 0;
}
.hbars li:hover .hbar-fill {
  background: var(--brand-deep);
}
.section-header a {
  color: var(--brand);
}
.glance-note {
  color: var(--text-muted);
}
@media (max-width: 1024px) {
  .glance-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .glance-kpi:nth-child(4) {
    border-left: 0;
    padding-left: 0;
  }
  .glance-panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .glance-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .glance-kpi:nth-child(odd) {
    border-left: 0;
    padding-left: 0;
  }
  .glance-kpi:nth-child(4) {
    border-left: 1px solid var(--border-subtle);
    padding-left: 18px;
  }
  .glance-panels {
    grid-template-columns: 1fr;
  }
}
</style>
