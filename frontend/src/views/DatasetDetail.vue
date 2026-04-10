<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">

      <!-- Loading -->
      <div v-if="loading" style="text-align:center; padding: 80px 0; color: var(--text-muted);">
        Loading dataset…
      </div>

      <!-- Not found -->
      <div v-else-if="notFound" class="placeholder-page">
        <span class="placeholder-icon">📊</span>
        <h1>Dataset not found</h1>
        <p>The dataset "{{ $route.params.pxd }}" could not be found in the {{ $route.params.name }} collection.</p>
        <router-link :to="`/collections/${$route.params.name}`" class="btn btn-primary" style="margin-top:20px; display:inline-flex;">
          ← Back to Collection
        </router-link>
      </div>

      <!-- Dataset detail -->
      <template v-else-if="dataset">
        <!-- Breadcrumb -->
        <div style="margin-bottom: 20px; font-size: 13px; color: var(--text-muted); display:flex; gap:6px; align-items:center;">
          <router-link to="/collections" style="color:var(--text-muted); text-decoration:none;">Collections</router-link>
          <span>›</span>
          <router-link :to="`/collections/${dataset.collection}`" style="color:var(--text-muted); text-decoration:none;">{{ collectionTitle }}</router-link>
          <span>›</span>
          <span style="font-family: var(--mono); color: var(--indigo);">{{ dataset.accession }}</span>
        </div>

        <!-- Header card -->
        <div class="detail-card" style="margin-bottom: 28px;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:20px; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
                <h1 style="font-size:22px; font-weight:800; font-family:var(--mono); color:var(--indigo);">{{ dataset.accession }}</h1>
                <span class="tag tag-indigo">{{ collectionTitle }}</span>
              </div>
              <p v-if="dataset.title && dataset.title !== dataset.accession" style="font-size:16px; font-weight:600; margin-bottom:10px; color:var(--text-primary);">
                {{ dataset.title }}
              </p>
              <p v-if="dataset.description" style="font-size:14px; color:var(--text-secondary); margin-bottom:12px; max-width:700px; line-height:1.6;">
                {{ dataset.description }}
              </p>
              <!-- Organisms -->
              <div v-if="dataset.organisms && dataset.organisms.length" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
                <span v-for="org in dataset.organisms" :key="org" class="tag tag-blue">{{ org }}</span>
              </div>
              <!-- MSNet extras -->
              <div v-if="dataset.instrument || dataset.enzyme" style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px; color:var(--text-secondary);">
                <span v-if="dataset.instrument">🔬 {{ dataset.instrument }}</span>
                <span v-if="dataset.enzyme">⚗️ {{ dataset.enzyme }}</span>
                <span v-if="dataset.fragment_method">📡 {{ dataset.fragment_method }}</span>
              </div>
            </div>

            <!-- Stats -->
            <div style="display:flex; gap:24px; flex-wrap:wrap; flex-shrink:0;">
              <div v-if="dataset.samples_total" style="text-align:center;">
                <div class="stat-value" style="font-size:22px;">{{ formatNum(dataset.samples_total) }}</div>
                <div class="stat-label">Samples</div>
              </div>
              <div v-if="dataset.runs_total" style="text-align:center;">
                <div class="stat-value" style="font-size:22px;">{{ formatNum(dataset.runs_total) }}</div>
                <div class="stat-label">Runs</div>
              </div>
              <div v-if="dataset.proteins_total" style="text-align:center;">
                <div class="stat-value" style="font-size:22px;">{{ formatNum(dataset.proteins_total) }}</div>
                <div class="stat-label">Proteins</div>
              </div>
              <div v-if="dataset.peptides_total" style="text-align:center;">
                <div class="stat-value" style="font-size:22px;">{{ formatNum(dataset.peptides_total) }}</div>
                <div class="stat-label">Peptides</div>
              </div>
              <div v-if="dataset.psm_count" style="text-align:center;">
                <div class="stat-value" style="font-size:22px;">{{ formatNum(dataset.psm_count) }}</div>
                <div class="stat-label">PSMs</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Structures -->
        <div v-if="dataset.structures && dataset.structures.length" style="margin-bottom:24px;">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px;">Available Data</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <span v-for="s in dataset.structures" :key="s" class="tag tag-green" style="font-size:12px; padding:4px 12px;">{{ s }}</span>
          </div>
        </div>

        <!-- Download section -->
        <div v-if="dataset.download" class="detail-card" style="margin-bottom:28px;">
          <h3 style="font-size:16px; font-weight:700; margin-bottom:16px;">Download</h3>

          <!-- QPX pull command -->
          <div style="margin-bottom:16px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">QPX Pull Command</div>
            <div class="code-block" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <span>
                <span class="code-keyword">qpx</span>
                <span> pull </span>
                <span class="code-string">{{ dataset.collection }}/{{ dataset.accession }}</span>
              </span>
              <button
                class="copy-btn"
                @click="copyCommand"
                :title="copied ? 'Copied!' : 'Copy command'"
              >{{ copied ? '✓ Copied' : 'Copy' }}</button>
            </div>
          </div>

          <!-- Download links -->
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <a
              v-if="dataset.download.ftp_url"
              :href="dataset.download.ftp_url"
              target="_blank"
              rel="noopener"
              class="btn btn-outline"
              style="font-size:13px; padding:8px 16px;"
            >
              📁 FTP Directory
            </a>
            <a
              v-if="dataset.download.sdrf_url"
              :href="dataset.download.sdrf_url"
              target="_blank"
              rel="noopener"
              class="btn btn-outline"
              style="font-size:13px; padding:8px 16px;"
            >
              📋 SDRF File
            </a>
          </div>
        </div>

        <!-- Reanalysis links -->
        <div v-if="dataset.reanalysis_links && dataset.reanalysis_links.length" class="detail-card" style="margin-bottom:28px;">
          <h3 style="font-size:16px; font-weight:700; margin-bottom:16px;">Reanalysis Files</h3>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <a
              v-for="link in dataset.reanalysis_links"
              :key="link.id"
              :href="link.path"
              target="_blank"
              rel="noopener"
              class="btn btn-outline"
              style="font-size:13px; padding:8px 16px;"
            >
              🔗 {{ link.title }}
            </a>
          </div>
        </div>

        <!-- Samples preview -->
        <div v-if="dataset.samples_preview && dataset.samples_preview.length" class="detail-card" style="margin-bottom:28px;">
          <h3 style="font-size:16px; font-weight:700; margin-bottom:16px;">
            Sample Preview
            <span style="font-size:13px; font-weight:400; color:var(--text-muted); margin-left:8px;">
              (showing {{ dataset.samples_preview.length }} of {{ dataset.samples_total }} samples)
            </span>
          </h3>
          <div class="dataset-table-wrap">
            <table class="dataset-table">
              <thead>
                <tr>
                  <th v-for="col in sampleColumns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in dataset.samples_preview" :key="i">
                  <td v-for="col in sampleColumns" :key="col" style="font-size:13px;">
                    {{ row[col] ?? '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Back link -->
        <div style="margin-top:12px;">
          <router-link :to="`/collections/${dataset.collection}`" style="font-size:13px; color:var(--indigo); text-decoration:none;">
            ← Back to {{ collectionTitle }}
          </router-link>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const dataset = ref(null)
const loading = ref(true)
const notFound = ref(false)
const copied = ref(false)

const collectionTitles = {
  'absolute-expression': 'Absolute Expression',
  'differential-expression': 'Differential Expression',
  'msnet': 'MS-Net',
  'single-cell': 'Single Cell',
}

const collectionTitle = computed(() =>
  collectionTitles[route.params.name] || route.params.name
)

const sampleColumns = computed(() => {
  if (!dataset.value?.samples_preview?.length) return []
  return Object.keys(dataset.value.samples_preview[0])
})

function formatNum(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString()
}

async function copyCommand() {
  const cmd = `qpx pull ${dataset.value.collection}/${dataset.value.accession}`
  try {
    await navigator.clipboard.writeText(cmd)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) {
    // fallback
  }
}

onMounted(async () => {
  const { name, pxd } = route.params
  try {
    const res = await fetch(`./data/collections/${name}/datasets/${pxd}.json`)
    if (!res.ok) throw new Error('Not found')
    dataset.value = await res.json()
  } catch (e) {
    notFound.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}

.copy-btn {
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.08);
  color: #e2e8f0;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.copy-btn:hover {
  background: rgba(255,255,255,0.16);
}
</style>
