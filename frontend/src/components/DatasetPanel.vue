<template>
  <div class="ds-panel" :class="{ 'ds-panel-full': variant === 'full' }">
    <!-- Title + organism -->
    <div class="ds-panel-head">
      <div>
        <h4 class="ds-panel-title">{{ displayTitle }}</h4>
        <div class="ds-panel-sub">
          <span v-if="organism" class="ds-organism">🧬 {{ organism }}</span>
          <span v-if="instrument" class="ds-instrument">🔬 {{ instrument }}</span>
          <span v-if="dataset.source" class="ds-source-tag">{{ dataset.source }}</span>
        </div>
      </div>
    </div>

    <!-- Stats row -->
    <div class="ds-stats">
      <div v-if="hasNum(dataset.proteins)" class="ds-stat">
        <div class="ds-stat-val">{{ formatNum(dataset.proteins) }}</div>
        <div class="ds-stat-label">Proteins</div>
      </div>
      <div v-if="hasNum(dataset.peptides)" class="ds-stat">
        <div class="ds-stat-val">{{ formatNum(dataset.peptides) }}</div>
        <div class="ds-stat-label">Peptides</div>
      </div>
      <div v-if="hasNum(dataset.samples)" class="ds-stat">
        <div class="ds-stat-val">{{ formatNum(dataset.samples) }}</div>
        <div class="ds-stat-label">Samples</div>
      </div>
      <div v-if="hasNum(dataset.psm_count)" class="ds-stat">
        <div class="ds-stat-val">{{ formatNum(dataset.psm_count) }}</div>
        <div class="ds-stat-label">PSMs</div>
      </div>
      <div v-if="dataset.total_size" class="ds-stat">
        <div class="ds-stat-val">{{ formatBytes(dataset.total_size) }}</div>
        <div class="ds-stat-label">Size</div>
      </div>
    </div>

    <!-- Cross-collection membership -->
    <div v-if="membership.length" class="ds-block">
      <div class="ds-block-label">In collections</div>
      <div class="ds-chips">
        <router-link
          v-for="c in membership"
          :key="c"
          :to="`/collections/${c}`"
          class="tag"
          :class="collectionTag(c)"
        >{{ c }}</router-link>
      </div>
    </div>

    <!-- Enrichment: summary (rendered only when present) -->
    <div v-if="dataset.summary" class="ds-block">
      <div class="ds-block-label">
        Summary <span class="ds-ai-tag">AI</span>
      </div>
      <p class="ds-summary">{{ dataset.summary }}</p>
    </div>

    <!-- Enrichment: description fallback -->
    <div v-else-if="dataset.description" class="ds-block">
      <div class="ds-block-label">Description</div>
      <p class="ds-summary">{{ dataset.description }}</p>
    </div>

    <!-- Keywords -->
    <div v-if="arr(dataset.keywords).length" class="ds-block">
      <div class="ds-block-label">Keywords</div>
      <div class="ds-chips">
        <span v-for="k in arr(dataset.keywords)" :key="k" class="tag tag-blue">{{ k }}</span>
      </div>
    </div>

    <!-- Tissues / diseases -->
    <div v-if="arr(dataset.tissues).length || arr(dataset.diseases).length" class="ds-block">
      <div class="ds-block-label">Tissue &amp; disease</div>
      <div class="ds-chips">
        <span v-for="t in arr(dataset.tissues)" :key="'t-' + t" class="tag tag-green">{{ t }}</span>
        <span v-for="d in arr(dataset.diseases)" :key="'d-' + d" class="tag tag-warning">{{ d }}</span>
      </div>
    </div>

    <!-- Publication -->
    <div v-if="hasPublication" class="ds-block">
      <div class="ds-block-label">Publication</div>
      <div class="ds-chips">
        <a
          v-if="dataset.publication && dataset.publication.pubmed"
          :href="`https://pubmed.ncbi.nlm.nih.gov/${dataset.publication.pubmed}/`"
          target="_blank"
          rel="noopener"
          class="ds-link"
        >PubMed {{ dataset.publication.pubmed }} ↗</a>
        <a
          v-if="dataset.publication && dataset.publication.doi"
          :href="`https://doi.org/${dataset.publication.doi}`"
          target="_blank"
          rel="noopener"
          class="ds-link"
        >DOI {{ dataset.publication.doi }} ↗</a>
      </div>
    </div>

    <!-- Downloads -->
    <div class="ds-block">
      <div class="ds-block-label">Downloads</div>
      <div class="ds-actions">
        <a
          v-if="s3Url"
          :href="s3Url"
          target="_blank"
          rel="noopener"
          class="btn btn-primary ds-btn"
        >📁 Download (S3)</a>
        <a
          v-if="sourceUrl"
          :href="sourceUrl"
          target="_blank"
          rel="noopener"
          class="btn btn-outline ds-btn"
        >{{ sourceLabel }} ↗</a>
        <router-link
          v-if="variant === 'inline'"
          :to="`/collections/${dataset.collection}/${dataset.accession}`"
          class="btn btn-outline ds-btn"
        >Open full page →</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatNum, formatBytes, cleanInstrument, collectionTag } from '../utils/format.js'
import { browseUrl } from '../config.js'

const props = defineProps({
  dataset: { type: Object, required: true },
  // 'inline' (accordion inside a table) or 'full' (standalone page)
  variant: { type: String, default: 'inline' },
})

function arr(v) {
  return Array.isArray(v) ? v.filter((x) => x != null && x !== '') : []
}
function hasNum(n) {
  return n != null && Number(n) > 0
}

const displayTitle = computed(() => {
  const t = props.dataset.title
  return t && t !== props.dataset.accession ? t : props.dataset.accession
})

const organism = computed(() => props.dataset.organism || '')
const instrument = computed(() => cleanInstrument(props.dataset.instrument))

// Cross-membership: prefer the enrichment `collections[]`, else the single collection.
const membership = computed(() => {
  const list = arr(props.dataset.collections)
  if (list.length) return list
  return props.dataset.collection ? [props.dataset.collection] : []
})

const hasPublication = computed(() => {
  const p = props.dataset.publication
  return !!(p && (p.pubmed || p.doi))
})

const s3Url = computed(() => props.dataset.download_url || browseUrl(props.dataset.dataset_ref))

const sourceUrl = computed(() => props.dataset.source_url || props.dataset.px_url || '')
const sourceLabel = computed(() => {
  const src = props.dataset.source
  if (src) return `${src} page`
  const acc = props.dataset.accession || ''
  if (acc.startsWith('PXD') || acc.startsWith('PRD')) return 'PRIDE page'
  if (acc.startsWith('MSV')) return 'MassIVE page'
  if (acc.startsWith('IPX')) return 'iProX page'
  if (acc.startsWith('PDC')) return 'PDC page'
  return 'Source page'
})
</script>

<style scoped>
.ds-panel {
  padding: 20px 24px;
  background: var(--bg-alt);
  border-top: 1px solid var(--border);
}
.ds-panel-full {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px;
}
.ds-panel-head {
  margin-bottom: 16px;
}
.ds-panel-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
  line-height: 1.4;
}
.ds-panel-sub {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-secondary);
  align-items: center;
}
.ds-source-tag {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 7px;
}
.ds-stats {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.ds-stat-val {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.ds-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.ds-block {
  margin-bottom: 16px;
}
.ds-block-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.ds-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ds-chips a.tag {
  text-decoration: none;
}
.ds-summary {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 760px;
}
.ds-ai-tag {
  font-size: 9px;
  font-weight: 700;
  color: var(--violet);
  background: rgba(124, 58, 237, 0.1);
  border-radius: 3px;
  padding: 1px 5px;
  margin-left: 4px;
  vertical-align: middle;
}
.ds-link {
  font-size: 13px;
  color: var(--indigo);
  text-decoration: none;
  font-weight: 500;
}
.ds-link:hover {
  text-decoration: underline;
}
.ds-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.ds-btn {
  font-size: 13px;
  padding: 8px 16px;
}
</style>
