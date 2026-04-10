<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">
      <template v-if="collection">
        <div class="section-header">
          <h2>{{ collection.title }}</h2>
          <p>{{ collection.description }}</p>
        </div>
        <div style="margin-bottom: 24px; display: flex; gap: 16px; justify-content: center;">
          <div v-for="(val, key) in collection.stats" :key="key" style="text-align: center;">
            <div class="stat-value" style="font-size: 22px;">{{ formatNumber(val) }}</div>
            <div class="stat-label">{{ formatLabel(key) }}</div>
          </div>
        </div>
        <div class="placeholder-page" style="padding-top: 40px; min-height: 30vh;">
          <p>Dataset listing for this collection will be populated when collection data is generated.</p>
        </div>
      </template>
      <template v-else>
        <div class="placeholder-page">
          <span class="placeholder-icon">&#128194;</span>
          <h1>Collection not found</h1>
          <p>The collection "{{ $route.params.name }}" could not be found in the registry.</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const collection = ref(null)

function formatNumber(n) {
  if (!n) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function formatLabel(key) {
  return key.replace(/^total_/, '').replace(/_/g, ' ')
}

onMounted(async () => {
  try {
    const res = await fetch('./data/registry.json')
    const data = await res.json()
    collection.value = (data.collections || []).find(c => c.name === route.params.name) || null
  } catch (e) {
    console.warn('Could not load registry.json:', e)
  }
})
</script>
