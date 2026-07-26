<template>
  <div class="section">
    <div class="container">
      <div class="section-header">
        <h2>Applications</h2>
        <p>Live services over the quantms data — each one also served to AI agents over MCP.</p>
      </div>

      <div class="app-grid">
        <router-link
          v-for="app in apps"
          :key="app.id"
          :to="app.to"
          class="app-card"
        >
          <div class="app-card-head">
            <h3>{{ app.title }}</h3>
            <span class="app-tier">tier {{ app.tier }}</span>
          </div>
          <p class="app-desc">{{ app.description }}</p>
          <span class="app-cta">Open →</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
// Curated catalog of the interactive analysis apps. Kept static (rather than the
// gateway /apps catalog) so newly-added apps appear immediately and apps still
// marked enabled:false in the manifest (e.g. a freshly deployed one) are listed.
const apps = [
  {
    id: 'dataset-search',
    title: 'Dataset Search',
    to: '/apps/dataset-search',
    tier: 2,
    description: 'Browse and search the reanalyzed dataset corpus by organism, instrument, disease, and other metadata.',
  },
  {
    id: 'peptide-search',
    title: 'Peptide Search',
    to: '/apps/peptide-search',
    tier: 1,
    description: 'Find peptides and proteins across the whole corpus, with per-dataset evidence and cross-resource links.',
  },
  {
    id: 'compass',
    title: 'Proteome Compass',
    to: '/apps/compass',
    tier: 2,
    description: 'Cross-species proteome coverage, evidence tiers, and the gaps quantms reanalysis could still close.',
  },
  {
    id: 'differential-expression',
    title: 'Differential Expression',
    to: '/differential-expression',
    tier: 2,
    description: 'Pick a dataset, contrast conditions, and explore differential expression — volcano, table, heatmap, and QC.',
  },
  {
    id: 'statistics',
    title: 'Statistics',
    to: '/statistics',
    tier: 1,
    description: 'Portal-wide KPIs and distributions: datasets, peptides, proteins, organisms, instruments, and PTMs.',
  },
]
</script>

<style scoped>
.section {
  padding: 3rem 0 4rem;
}
.section-header {
  margin-bottom: 2rem;
}
.section-header h2 {
  font-size: 1.9rem;
  margin: 0 0 0.35rem;
}
.section-header p {
  color: var(--text-secondary);
  margin: 0;
  max-width: 48rem;
}
.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: 1.1rem;
}
.app-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.25rem 1.35rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface, transparent);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}
.app-card:hover,
.app-card:focus-visible {
  border-color: var(--accent, #4f7cff);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
  outline: none;
}
.app-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}
.app-card-head h3 {
  margin: 0;
  font-size: 1.15rem;
}
.app-tier {
  font-size: 0.7rem;
  color: var(--text-muted, #8a94a6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.app-desc {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
  flex: 1;
}
.app-cta {
  font-weight: 600;
  color: var(--accent, #4f7cff);
  font-size: 0.95rem;
}
</style>
