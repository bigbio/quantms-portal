<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">
      <div class="section-header">
        <h2>All Collections</h2>
        <p>Curated groups of datasets, each with specialized indexes and services</p>
      </div>
      <div class="collection-grid">
        <CollectionCard
          v-for="col in collections"
          :key="col.name"
          :collection="col"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import CollectionCard from '../components/CollectionCard.vue'

const collections = ref([])

onMounted(async () => {
  try {
    const res = await fetch('./data/registry.json')
    const data = await res.json()
    collections.value = data.collections || []
  } catch (e) {
    console.warn('Could not load registry.json:', e)
  }
})
</script>
