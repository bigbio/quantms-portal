<template>
  <div class="placeholder-page">
    <div class="container">
      <span class="placeholder-icon" aria-hidden="true">🧭</span>
      <h1>Page not found</h1>
      <p>
        There is no page at <code class="nf-path">{{ path }}</code>.
        It may have moved, or the link may be mistyped.
      </p>
      <div class="nf-actions">
        <router-link to="/" class="btn btn-primary">Go to the portal home</router-link>
        <router-link to="/applications" class="btn btn-outline">Browse applications</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const path = computed(() => route.path)
</script>

<style scoped>
.nf-path {
  font-family: var(--font-mono, monospace);
  word-break: break-all;
}
.nf-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}
</style>
