<template>
  <section class="page-head">
    <div class="container">
      <h1>Applications</h1>
      <p>Live services over the quantms data.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <AppGrid :apps="[...APPS, ...registry]" />
      <p class="table-note">
        AI agents can list collections, datasets and applications through the MCP endpoint
        <code>https://publish.quantms.org/mcp/</code>.
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppGrid from '../components/AppGrid.vue'
import { APPS, registryApps } from '../apps.js'

// Registry-only apps; when the gateway is unreachable the curated list stands alone.
const registry = ref([])
onMounted(() => registryApps().then((r) => (registry.value = r), () => {}))
</script>
