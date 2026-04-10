<template>
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-badge">AI-Ready Proteomics Data</div>
      <h1>The Quantitative Proteomics<br>Data Portal</h1>
      <p class="hero-sub">
        Browse, query, and download standardized proteomics datasets in
        <strong>QPX format</strong>. Built for AI agents, bioinformaticians,
        and researchers. Every dataset is queryable via SQL, accessible through
        MCP, and downloadable with one command.
      </p>
      <div class="search-box">
        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search peptides, proteins, datasets, organisms..."
          class="search-input"
          @keyup.enter="goSearch"
        >
        <button class="search-btn" @click="goSearch">Search</button>
      </div>
      <div class="search-suggestions">
        <span class="search-tag" @click="searchQuery = 'TYQGSYGFR'; goSearch()">TYQGSYGFR</span>
        <span class="search-tag" @click="searchQuery = 'TP53'; goSearch()">TP53</span>
        <span class="search-tag" @click="searchQuery = 'Homo sapiens'; goSearch()">Homo sapiens</span>
        <span class="search-tag" @click="searchQuery = 'liver'; goSearch()">liver</span>
        <span class="search-tag" @click="searchQuery = 'DIA'; goSearch()">DIA</span>
        <span class="search-tag" @click="searchQuery = 'breast cancer'; goSearch()">breast cancer</span>
      </div>
    </div>
  </section>

  <StatsRibbon v-if="globalStats" :stats="globalStats" />

  <section class="section" id="collections">
    <div class="container">
      <div class="section-header">
        <h2>Collections</h2>
        <p>Curated groups of datasets, each with specialized indexes and services built on top</p>
      </div>
      <div class="collection-grid">
        <CollectionCard
          v-for="col in collections"
          :key="col.name"
          :collection="col"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StatsRibbon from '../components/StatsRibbon.vue'
import CollectionCard from '../components/CollectionCard.vue'

const router = useRouter()
const searchQuery = ref('')
const collections = ref([])
const globalStats = ref(null)

function goSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/search', query: { q: searchQuery.value.trim() } })
  }
}

onMounted(async () => {
  try {
    const res = await fetch('./data/registry.json')
    const data = await res.json()
    collections.value = data.collections || []
    globalStats.value = data.global_stats || null
  } catch (e) {
    console.warn('Could not load registry.json:', e)
  }
})
</script>
