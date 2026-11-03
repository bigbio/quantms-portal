<template>
  <section v-if="!failed" class="section spotlight" aria-labelledby="spot-title">
    <div class="container">
      <div class="spot-head">
        <div>
          <h2 id="spot-title" class="rule-title">Protein spotlight</h2>
          <p class="section-lede">One protein a day, seen through every dataset in the portal.</p>
        </div>
        <button type="button" class="btn btn-outline" :disabled="loading" @click="next">Show another protein</button>
      </div>

      <div v-if="loading && !facts" class="spot-skeleton" aria-busy="true"></div>
      <article v-else-if="facts" class="spot-card" :aria-busy="loading">
        <div class="spot-id">
          <h3>
            {{ facts.name }}
            <span class="spot-gene">{{ facts.gene }}</span>
          </h3>
          <p class="spot-acc">
            UniProt <a :href="`https://www.uniprot.org/uniprotkb/${facts.accession}/entry`" target="_blank" rel="noopener">{{ facts.accession }}</a>
          </p>
          <p class="spot-note">{{ note }}</p>
          <dl class="spot-figs">
            <div><dt>Sequence covered</dt><dd>{{ facts.coverage != null ? `${facts.coverage}%` : '—' }}</dd></div>
            <div><dt>Peptides</dt><dd>{{ facts.peptides.toLocaleString('en-US') }}</dd></div>
            <div><dt>Datasets</dt><dd>{{ facts.datasets.toLocaleString('en-US') }}</dd></div>
            <div><dt>Tissues</dt><dd>{{ facts.nTissues }}</dd></div>
          </dl>
          <router-link :to="profileLink" class="spot-more">Full profile: coverage map, peptides and datasets →</router-link>
        </div>

        <figure v-if="facts.tissues.length" class="spot-panel">
          <figcaption>Datasets per tissue</figcaption>
          <ol class="hbars">
            <li v-for="t in facts.tissues" :key="t.label" :title="`${t.label}: ${t.value} datasets`">
              <span class="hbar-label">{{ t.label }}</span>
              <span class="hbar-track"><span class="hbar-fill" :style="{ width: `${Math.max(t.share * 100, 1.5)}%` }"></span></span>
              <span class="hbar-value">{{ t.value }}</span>
            </li>
          </ol>
        </figure>

        <div v-if="facts.ptms.length" class="spot-panel">
          <h4>Biological modifications</h4>
          <ul class="spot-ptms">
            <li v-for="m in facts.ptms" :key="m.site">
              <span class="ptm-badge ptm-bio">{{ m.site }}</span>
              <span class="spot-ptm-n">in {{ m.datasets }} datasets</span>
            </li>
          </ul>
          <p class="spot-hint">Fixed labels and sample-handling artefacts (carbamidomethyl, TMT, oxidation) are left out.</p>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiGet } from '../../api.js'
import { PEPTIDE_SEARCH_BASE, PROTEIN_PROFILE_TIMEOUT_MS } from '../../config.js'
import { SPOTLIGHT_PROTEINS, spotlightIndex, spotlightFacts } from '../../utils/homeData.js'

const index = ref(spotlightIndex())
const facts = ref(null)
const loading = ref(false)
// Hidden when the service is down on first load; a failed "show another" keeps the current protein.
const failed = ref(false)

const note = computed(() => SPOTLIGHT_PROTEINS[index.value].note)
const profileLink = computed(() => ({ path: '/apps/peptide-search', query: { mode: 'protein', query: facts.value?.accession } }))

async function load(i) {
  loading.value = true
  try {
    const p = await apiGet(PEPTIDE_SEARCH_BASE, '/protein/profile', { accession: SPOTLIGHT_PROTEINS[i].accession }, { retries: 2, timeout: PROTEIN_PROFILE_TIMEOUT_MS })
    const f = spotlightFacts(p)
    if (f) {
      facts.value = f
      index.value = i
    } else if (!facts.value) {
      failed.value = true
    }
  } catch {
    if (!facts.value) failed.value = true
  } finally {
    loading.value = false
  }
}

function next() {
  load((index.value + 1) % SPOTLIGHT_PROTEINS.length)
}

onMounted(() => load(index.value))
</script>

<style scoped>
.spot-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.spot-card {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 40px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 28px;
}
.spot-card[aria-busy='true'] {
  opacity: 0.6;
}
.spot-id h3 {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.25;
}
.spot-gene {
  font-family: var(--mono);
  font-size: 16px;
  font-weight: 500;
  color: var(--brand);
  margin-left: 6px;
}
.spot-acc {
  font-size: 14px;
  color: var(--text-muted);
  margin: 4px 0 12px;
}
.spot-acc a {
  font-family: var(--mono);
  color: var(--brand);
}
.spot-note {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 18px;
}
.spot-figs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.spot-figs dt {
  font-size: 12px;
  color: var(--text-muted);
}
.spot-figs dd {
  font-size: 24px;
  font-weight: 600;
  color: var(--brand-deep);
}
.spot-more {
  font-size: 14px;
  font-weight: 500;
  color: var(--brand);
}
.spot-panel figcaption,
.spot-panel h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}
.spot-ptms {
  list-style: none;
}
.spot-ptms li {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 13px;
}
.spot-ptms .ptm-badge {
  font-size: 12px;
  font-family: var(--mono);
}
.spot-ptm-n {
  color: var(--text-secondary);
}
.spot-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 10px;
}
.spot-skeleton {
  height: 260px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}
.hbars {
  list-style: none;
}
.hbars li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  grid-template-areas: 'label value' 'track track';
  column-gap: 8px;
  margin-bottom: 9px;
  font-size: 13px;
}
.hbar-label {
  grid-area: label;
  text-transform: capitalize;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hbar-value {
  grid-area: value;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.hbar-track {
  grid-area: track;
  height: 8px;
  margin-top: 3px;
}
.hbar-fill {
  display: block;
  height: 100%;
  background: var(--brand);
  border-radius: 0 4px 4px 0;
}
@media (max-width: 1024px) {
  .spot-card {
    grid-template-columns: 1fr 1fr;
  }
  .spot-id {
    grid-column: 1 / -1;
  }
}
@media (max-width: 640px) {
  .spot-card {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 20px;
  }
  .spot-figs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
