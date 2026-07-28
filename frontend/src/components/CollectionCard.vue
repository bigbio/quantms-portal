<template>
  <div class="collection-card" @click="$emit('select', collection.name)" style="cursor: pointer;">
    <div class="collection-card-accent"></div>
    <div class="collection-icon" :class="iconClass">
      <svg v-if="collection.name === 'msnet'" width="26" height="26" viewBox="0 0 24 24" fill="none" :stroke="iconColor" stroke-width="1.6">
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
      </svg>
      <svg v-else-if="collection.name === 'absolute-expression'" width="26" height="26" viewBox="0 0 24 24" fill="none" :stroke="iconColor" stroke-width="1.6">
        <path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="7" rx="1"/><rect x="13" y="9" width="3" height="11" rx="1"/><rect x="19" y="5" width="3" height="15" rx="1"/>
      </svg>
      <svg v-else width="26" height="26" viewBox="0 0 24 24" fill="none" :stroke="iconColor" stroke-width="1.6">
        <path d="M3 12h4l3-9 4 18 3-9h4"/>
      </svg>
    </div>
    <h3>{{ collection.title }}</h3>
    <p class="desc">{{ collection.description }}</p>
    <div class="collection-stats">
      <div class="collection-stat">
        <div class="collection-stat-val">{{ collection.dataset_count }}</div>
        <div class="collection-stat-label">Datasets</div>
      </div>
      <div v-if="collection.stats?.total_features" class="collection-stat">
        <div class="collection-stat-val">{{ formatNumber(collection.stats.total_features) }}</div>
        <div class="collection-stat-label">Features</div>
      </div>
      <div v-else-if="collection.stats?.total_psms" class="collection-stat">
        <div class="collection-stat-val">{{ formatNumber(collection.stats.total_psms) }}</div>
        <div class="collection-stat-label">PSMs</div>
      </div>
      <div v-if="collection.stats?.total_proteins" class="collection-stat">
        <div class="collection-stat-val">{{ formatNumber(collection.stats.total_proteins) }}</div>
        <div class="collection-stat-label">Proteins</div>
      </div>
      <div v-if="collection.stats?.total_species" class="collection-stat">
        <div class="collection-stat-val">{{ collection.stats.total_species }}</div>
        <div class="collection-stat-label">Species</div>
      </div>
      <div v-if="collection.stats?.total_samples" class="collection-stat">
        <div class="collection-stat-val">{{ formatNumber(collection.stats.total_samples) }}</div>
        <div class="collection-stat-label">Samples</div>
      </div>
      <div v-if="collection.stats?.total_runs" class="collection-stat">
        <div class="collection-stat-val">{{ formatNumber(collection.stats.total_runs) }}</div>
        <div class="collection-stat-label">Runs</div>
      </div>
      <div v-if="collection.stats?.total_peptides" class="collection-stat">
        <div class="collection-stat-val">{{ formatNumber(collection.stats.total_peptides) }}</div>
        <div class="collection-stat-label">Peptides</div>
      </div>
      <div v-if="collection.stats?.total_tissues" class="collection-stat">
        <div class="collection-stat-val">{{ collection.stats.total_tissues }}</div>
        <div class="collection-stat-label">Tissues</div>
      </div>
      <div v-if="collection.stats?.total_contrasts" class="collection-stat">
        <div class="collection-stat-val">{{ collection.stats.total_contrasts }}</div>
        <div class="collection-stat-label">Contrasts</div>
      </div>
    </div>
    <div class="collection-tags">
      <span v-for="org in displayOrganisms" :key="org" class="tag" :class="organismTagClass(org)">
        {{ shortOrganism(org) }}
      </span>
      <span v-if="extraOrganismCount > 0" class="tag" style="background: rgba(100,116,139,0.08); color: var(--text-muted);">
        +{{ extraOrganismCount }} more
      </span>
    </div>
    <span class="collection-cta">Browse collection &rarr;</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  collection: { type: Object, required: true }
})

defineEmits(['select'])

const colorMap = {
  'msnet': { icon: 'ci-blue', color: '#409eff' },
  'absolute-expression': { icon: 'ci-indigo', color: '#6366f1' },
  'differential-expression': { icon: 'ci-violet', color: '#7c3aed' },
}

const iconClass = computed(() => colorMap[props.collection.name]?.icon || 'ci-blue')
const iconColor = computed(() => colorMap[props.collection.name]?.color || '#409eff')

const MAX_ORGANISMS = 5
const displayOrganisms = computed(() => {
  const orgs = props.collection.organisms || []
  return orgs.slice(0, MAX_ORGANISMS)
})
const extraOrganismCount = computed(() => {
  const orgs = props.collection.organisms || []
  return Math.max(0, orgs.length - MAX_ORGANISMS)
})

function shortOrganism(org) {
  const map = {
    'Homo sapiens': 'H. sapiens',
    'Mus musculus': 'M. musculus',
    'Danio rerio': 'D. rerio',
  }
  return map[org] || org
}

function organismTagClass(org) {
  if (org === 'Homo sapiens') return 'tag-blue'
  if (org === 'Mus musculus') return 'tag-indigo'
  return 'tag-violet'
}

function formatNumber(n) {
  if (!n) return '—'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
</script>
