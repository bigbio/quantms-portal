<template>
  <div class="placeholder-page">
    <div class="container">
      <span class="placeholder-icon">&#128269;</span>
      <h1>Cross-Collection Search</h1>
      <p v-if="query" style="margin-bottom: 16px;">
        Searching for: <strong>{{ query }}</strong>
      </p>
      <p>
        Full-text search across all collections requires the query service
        to be configured. In the meantime, you can browse collections and
        datasets directly, or use the MCP API for programmatic queries.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const query = computed(() => route.query.q || '')
</script>
