<template>
  <div v-if="hasCredits" class="cite">
    <div class="cite-head">
      <span class="cite-title">Cite this data</span>
      <span class="cite-nudge">Please cite the original data and quantms.</span>
    </div>

    <ul class="cite-list">
      <li v-for="c in credits" :key="c.ref || c.accession" class="cite-item">
        <span class="cite-ds-title">{{ c.title || c.accession }}</span>
        <span v-if="c.submitter" class="cite-meta"> — {{ c.submitter.name }}</span>
        <span class="cite-links">
          <a v-if="c.repository && c.repository.url" :href="c.repository.url" target="_blank" rel="noopener">
            {{ c.repository.name }} {{ c.accession }} &#8599;
          </a>
          <a v-if="c.publication && c.publication.doi" :href="`https://doi.org/${c.publication.doi}`" target="_blank" rel="noopener">
            doi:{{ c.publication.doi }} &#8599;
          </a>
        </span>
      </li>
    </ul>

    <div class="cite-actions">
      <button v-for="s in styles" :key="s.key" type="button" class="cite-btn" @click="copy(s.key)">
        {{ copied === s.key ? 'Copied!' : s.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getCredits } from '../citation.js'

// `refs` is the list of contributing dataset refs ("ACC/hash"). For a single
// dataset page it's one ref; for a claim it will be the top contributors.
const props = defineProps({ refs: { type: Array, default: () => [] } })

const credits = ref([])
const citations = ref({})
const copied = ref('')

const styles = [
  { key: 'text', label: 'Copy citation' },
  { key: 'bibtex', label: 'BibTeX' },
  { key: 'ris', label: 'RIS' },
]

const hasCredits = computed(() => credits.value.length > 0)

async function load() {
  const refs = (props.refs || []).filter(Boolean)
  if (!refs.length) { credits.value = []; citations.value = {}; return }
  try {
    const res = await getCredits(refs)
    credits.value = (res && res.credits) || []
    citations.value = (res && res.citations) || {}
  } catch (e) {
    credits.value = []
    citations.value = {}
  }
}

async function copy(styleKey) {
  const text = citations.value[styleKey]
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = styleKey
    setTimeout(() => { if (copied.value === styleKey) copied.value = '' }, 1500)
  } catch (e) {
    // clipboard blocked — no-op; the links above remain usable
  }
}

watch(() => props.refs, load)
onMounted(load)
</script>

<style scoped>
.cite { border: 1px solid var(--border, #e2e5ea); border-radius: 10px; padding: 12px 14px; margin-top: 12px; background: var(--surface, #fafbfc); }
.cite-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.cite-title { font-weight: 600; font-size: 14px; }
.cite-nudge { color: var(--muted, #6b7280); font-size: 12px; }
.cite-list { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.cite-item { font-size: 13px; line-height: 1.5; }
.cite-ds-title { font-weight: 500; }
.cite-meta { color: var(--muted, #6b7280); }
.cite-links { display: block; margin-top: 2px; }
.cite-links a { color: var(--accent, #2563eb); font-size: 12px; margin-right: 12px; }
.cite-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cite-btn { padding: 4px 12px; border: 1px solid var(--border, #cbd5e1); border-radius: 6px; background: #fff; color: var(--text, #1f2937); font-size: 12px; cursor: pointer; }
.cite-btn:hover { border-color: var(--accent, #2563eb); color: var(--accent, #2563eb); }
</style>
