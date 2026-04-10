<template>
  <section class="stats-ribbon">
    <div class="stats-inner">
      <div class="stat-item">
        <div class="stat-value">{{ stats.total_collections }}</div>
        <div class="stat-label">Collections</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.total_datasets }}</div>
        <div class="stat-label">Datasets</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-value">{{ formatNumber(stats.total_psms) }}</div>
        <div class="stat-label">PSMs</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-value">{{ formatNumber(stats.total_peptides) }}</div>
        <div class="stat-label">Peptides</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-value">{{ formatNumber(stats.total_proteins) }}</div>
        <div class="stat-label">Proteins</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.mcp_tools }}</div>
        <div class="stat-label">MCP Tools</div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  stats: {
    type: Object,
    required: true
  }
})

function formatNumber(n) {
  if (!n) return '—'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
</script>
