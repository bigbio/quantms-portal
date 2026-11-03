<template>
  <figure class="fig-card organism-card" :aria-busy="!stats && !failed">
    <p class="fig-title"><b>Distinct proteins per organism</b> <span>peptide search index</span></p>

    <ol v-if="rows.length" class="bars">
      <li
        v-for="(r, i) in rows"
        :key="r.name"
        :style="{ '--i': i }"
        :title="`${r.organism}: ${r.proteins.toLocaleString()} proteins, ${r.peptides.toLocaleString()} peptides${groups[r.organism] ? ` · ${groups[r.organism].group}` : ''}`"
      >
        <span class="bar-name">{{ r.name }}</span>
        <span class="bar-meta">{{ r.datasets }} {{ r.datasets === 1 ? 'dataset' : 'datasets' }}</span>
        <span class="bar-line">
          <span class="bar" :style="{ width: `calc(${r.proteins / longest} * (100% - 4.5em))`, background: colourOf(r.organism) }" />
          <span class="bar-value">{{ formatBig(r.proteins) }}</span>
        </span>
      </li>
    </ol>
    <ol v-else-if="!failed" class="bars" aria-hidden="true">
      <li v-for="(f, i) in SKELETON" :key="i">
        <span class="bar-name"><span class="skel" :style="{ width: `${7 + (i % 3) * 2}em` }" /></span>
        <span class="bar-line">
          <span class="bar skel" :style="{ width: `calc(${f} * (100% - 4.5em))` }" />
          <span class="bar-value">&nbsp;</span>
        </span>
      </li>
    </ol>
    <p v-else class="fig-empty">
      Organism figures are unavailable right now; see the
      <router-link to="/statistics">Statistics</router-link> page.
    </p>

    <ChartLegend v-if="legend.length" :items="legend" class="organism-legend" />

    <figcaption v-if="!failed">
      Common model organisms in the index, coloured by taxonomic group (UniProt taxonomy); proteins
      are counted as distinct genes. Index generated
      <LiveValue :value="stats?.generated_at.slice(0, 10)" width="6em" />. Full breakdown on the
      <router-link to="/statistics">Statistics</router-link> page.
    </figcaption>
  </figure>
</template>

<script setup>
import { computed } from 'vue'
import LiveValue from './LiveValue.vue'
import ChartLegend from './ChartLegend.vue'
import { formatBig } from '../utils/format.js'
import { chartColor } from '../utils/chartColors.js'
import { TAXON_GROUPS, groupLegend, taxonGroup, useGroups } from '../chartGroups.js'

const props = defineProps({
  // stats.json of the peptide search index; null while it loads.
  stats: { type: Object, default: null },
  failed: { type: Boolean, default: false },
})

const MODEL_ORGANISMS = ['Homo sapiens', 'Mus musculus', 'Rattus norvegicus', 'Arabidopsis thaliana', 'Saccharomyces cerevisiae']
// Bar lengths of the loading placeholder, as fractions of the longest bar.
const SKELETON = [1, 0.9, 0.4, 0.7, 0.25]

// A model's row is its exact name or a strain of it ("Escherichia coli K-12"), the one with most datasets.
const rows = computed(() => {
  const species = (props.stats?.species || []).filter((r) => !String(r.organism).includes(';'))
  return MODEL_ORGANISMS.flatMap((name) => {
    const low = name.toLowerCase()
    const hits = species.filter((r) => {
      const o = String(r.organism).toLowerCase()
      return o === low || o.startsWith(`${low} `)
    })
    if (!hits.length) return []
    const best = hits.reduce((a, b) => (b.datasets > a.datasets ? b : a))
    return [{ ...best, name }]
  })
})
const longest = computed(() => Math.max(1, ...rows.value.map((r) => r.proteins)))

// Bars wait in grey until their organism's group arrives.
const { groups } = useGroups(() => rows.value.map((r) => r.organism), taxonGroup)
const colourOf = (name) => groups.value[name]?.colour || chartColor('other')
const legend = computed(() => groupLegend(TAXON_GROUPS, rows.value.map((r) => groups.value[r.organism]).filter(Boolean)))
</script>

<style scoped>
.organism-card {
  margin: 0;
  padding: 16px 18px 14px;
  background: #fff;
  color: var(--text-primary);
  border: 1px solid var(--on-dark-rule);
  border-radius: 6px;
}
.fig-title {
  font-size: 15px;
  margin-bottom: 14px;
}
.fig-title b {
  font-weight: 600;
}
.fig-title span {
  color: var(--text-muted);
  font-size: 13px;
}
.bars {
  list-style: none;
  display: grid;
  gap: 12px;
}
.bars li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  row-gap: 3px;
  font-size: 14px;
}
.bar-name {
  font-weight: 500;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.bar-meta {
  font-size: 12px;
  color: var(--text-muted);
}
.bar-line {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.bar {
  flex: none;
  height: 12px;
  border-radius: 0 4px 4px 0;
  transform-origin: left center;
  transition: background-color 240ms ease-out;
  animation: bar-grow 700ms var(--ease-enter) both;
  animation-delay: calc(var(--i) * 60ms);
}
.bars li:hover .bar {
  filter: brightness(0.85);
}
.organism-legend {
  margin: 14px 0 0;
}
.bar-value {
  font-size: 13px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  animation: data-in 240ms ease-out both;
  animation-delay: calc(280ms + var(--i) * 60ms);
}
.bar.skel {
  height: 12px;
  color: var(--text-muted);
  background: currentColor;
  border-radius: 0 4px 4px 0;
  transform: none;
  animation: skel-pulse 1.6s ease-in-out infinite;
}
.bar-name .skel {
  color: var(--text-muted);
}
.fig-empty {
  font-size: 14px;
  color: var(--text-secondary);
}
.fig-empty a,
figcaption a {
  color: var(--brand);
}
figcaption .skel {
  height: 0.9em;
}
figcaption {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  font-size: 12.5px;
  color: var(--text-muted);
}
@keyframes bar-grow {
  from {
    transform: scaleX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar,
  .bar-value,
  .bar.skel {
    animation: none;
  }
}
</style>
