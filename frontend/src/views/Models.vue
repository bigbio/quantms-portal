<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">

      <!-- Page header -->
      <div style="margin-bottom: 32px;">
        <div class="hero-badge" style="margin-bottom: 12px;">ML Models</div>
        <h1 style="font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
          Models
        </h1>
        <p style="font-size: 15px; color: var(--text-secondary); max-width: 640px;">
          Machine learning models trained on quantms reanalysis collections.
          These models power spectrum prediction, retention time estimation, and PSM rescoring
          across the quantms ecosystem. All models are freely available via FTP.
        </p>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <select v-model="filterCollection" class="filter-select">
            <option value="">All Collections</option>
            <option v-for="col in collections" :key="col" :value="col">{{ col }}</option>
          </select>
          <select v-model="filterTool" class="filter-select">
            <option value="">All Tools</option>
            <option v-for="tool in tools" :key="tool" :value="tool">{{ tool }}</option>
          </select>
          <input
            v-model="searchQuery"
            type="text"
            class="filter-search"
            placeholder="Search models..."
          />
        </div>
        <span class="result-count">{{ filteredModels.length }} model{{ filteredModels.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Loading -->
      <div v-if="loading" style="text-align:center; padding: 64px 0; color: var(--text-muted);">
        Loading models...
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredModels.length === 0" style="text-align:center; padding: 64px 0; color: var(--text-muted);">
        <div style="font-size: 40px; margin-bottom: 16px;">&#129302;</div>
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">No models found</div>
        <div style="font-size: 13px;">Try adjusting your filters.</div>
      </div>

      <!-- Models table -->
      <template v-else>
        <div class="dataset-table-wrap">
          <table class="dataset-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Collection</th>
                <th>Tool</th>
                <th>Format</th>
                <th>Date</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="model in filteredModels" :key="model.name">
                <td>
                  <span class="model-name">{{ model.name }}</span>
                </td>
                <td class="td-title" style="max-width: 300px; white-space: normal;">
                  <span style="font-size: 13px; color: var(--text-secondary);">{{ model.description }}</span>
                </td>
                <td>
                  <span class="tag tag-indigo">{{ model.collection }}</span>
                </td>
                <td>
                  <span class="tag tag-blue">{{ model.tool }}</span>
                </td>
                <td>
                  <span class="tag" :class="formatTagClass(model.format)">{{ model.format }}</span>
                </td>
                <td class="td-num" style="text-align: left;">{{ model.date }}</td>
                <td>
                  <a :href="model.url" target="_blank" rel="noopener" class="download-link">
                    FTP &#8599;
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- FTP info callout -->
      <div class="ftp-callout" style="margin-top: 40px;">
        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 22px; flex-shrink: 0;">&#128230;</div>
          <div>
            <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
              All models are hosted on PRIDE FTP
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 10px;">
              Models are stored at
              <a
                href="https://ftp.pride.ebi.ac.uk/pub/databases/pride/resources/proteomes/quantms-models/"
                target="_blank"
                rel="noopener"
                class="accession-link"
                style="font-family: var(--mono); font-size: 12px;"
              >ftp.pride.ebi.ac.uk/…/quantms-models/</a>
              and are freely available for download and use.
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const loading = ref(false)
const models = ref([])
const searchQuery = ref('')
const filterCollection = ref('')
const filterTool = ref('')

const collections = computed(() => {
  return [...new Set(models.value.map(m => m.collection))].sort()
})

const tools = computed(() => {
  return [...new Set(models.value.map(m => m.tool))].sort()
})

const filteredModels = computed(() => {
  let result = models.value
  if (filterCollection.value) {
    result = result.filter(m => m.collection === filterCollection.value)
  }
  if (filterTool.value) {
    result = result.filter(m => m.tool === filterTool.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      m.tool.toLowerCase().includes(q) ||
      m.collection.toLowerCase().includes(q)
    )
  }
  return result
})

function formatTagClass(format) {
  if (!format) return 'tag-blue'
  const f = format.toLowerCase()
  if (f === 'onnx') return 'tag-violet'
  if (f === 'hdf5' || f === 'h5') return 'tag-green'
  if (f === 'pickle') return 'tag-blue'
  return 'tag-blue'
}

onMounted(async () => {
  loading.value = true
  try {
    const base = import.meta.env.BASE_URL
    const res = await fetch(`${base}data/models.json`)
    if (res.ok) {
      models.value = await res.json()
    }
  } catch (e) {
    console.warn('Could not load models.json:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.model-name {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.download-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--indigo);
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  transition: background 0.15s, border-color 0.15s;
}

.download-link:hover {
  background: rgba(99, 102, 241, 0.06);
  border-color: var(--indigo);
}

.ftp-callout {
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
  padding: 20px 24px;
}
</style>
