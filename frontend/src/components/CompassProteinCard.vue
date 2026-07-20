<template>
  <div class="compass-card">
    <div class="cc-head">
      <div>
        <span class="cc-acc">{{ profile.uniprot_acc }}</span>
        <span v-if="profile.gene" class="cc-gene">{{ profile.gene }}</span>
      </div>
      <div class="cc-badges">
        <span class="cc-tier" :class="'tier-' + profile.evidence_tier">{{ profile.evidence_tier }}</span>
        <span v-if="profile.hpp_compliant" class="cc-hpp" title="Meets HPP 3.0 rigor (≥2 unique ≥9-aa peptides, class-1 FDR, USI-referenced)">HPP-compliant</span>
      </div>
    </div>

    <!-- Agreement banner: PA↔quantms concordance is MS, not independent -->
    <div v-if="agreement" class="cc-banner" :class="agreement.ms_concordant ? 'concordant' : 'neutral'">
      <template v-if="agreement.ms_concordant">MS-concordant (quantms + PeptideAtlas) — <em>not independent</em>; orthogonal axis: UniProt&nbsp;PE / HPA.</template>
      <template v-else>Evidence spans different axes — see columns below.</template>
    </div>

    <div class="cc-cols">
      <!-- quantms -->
      <div class="cc-col">
        <h4>quantms</h4>
        <template v-if="profile.quantms_observed">
          <div class="cc-yes">Observed</div>
          <dl>
            <div><dt>Datasets</dt><dd>{{ profile.n_datasets ?? '—' }}</dd></div>
            <div><dt>Unique peptides</dt><dd>{{ profile.n_unique_peptides ?? '—' }}</dd></div>
            <div v-if="profile.coverage_pct != null"><dt>Coverage</dt><dd>{{ profile.coverage_pct }}%</dd></div>
            <div v-if="profile.pgpp != null"><dt>pGPP</dt><dd>{{ profile.pgpp }}</dd></div>
          </dl>
          <div v-if="usis.length" class="cc-usis">
            <div class="cc-usis-label">USIs</div>
            <code v-for="u in usis" :key="u">{{ u }}</code>
          </div>
        </template>
        <div v-else class="cc-no">Not observed</div>
      </div>

      <!-- PeptideAtlas -->
      <div class="cc-col">
        <h4>PeptideAtlas</h4>
        <template v-if="profile.pa_observed">
          <div class="cc-yes">{{ profile.pa_presence_level || 'Observed' }}</div>
          <dl>
            <div><dt>Samples</dt><dd>{{ profile.pa_n_samples ?? '—' }}</dd></div>
            <div><dt>Observations</dt><dd>{{ profile.pa_n_observations ?? '—' }}</dd></div>
            <div><dt>Tissues</dt><dd>{{ profile.pa_n_tissues ?? '—' }}</dd></div>
          </dl>
        </template>
        <div v-else class="cc-no">Not in build</div>
      </div>

      <!-- UniProt -->
      <div class="cc-col">
        <h4>UniProt</h4>
        <dl>
          <div><dt>PE level</dt><dd>{{ profile.uniprot_pe != null ? 'PE' + profile.uniprot_pe : '—' }}</dd></div>
          <div v-if="profile.seq_len"><dt>Length</dt><dd>{{ profile.seq_len }} aa</dd></div>
          <div v-if="profile.ensembl_gene"><dt>Ensembl</dt><dd>{{ profile.ensembl_gene }}</dd></div>
        </dl>
      </div>

      <!-- HPA -->
      <div class="cc-col" v-if="hasHpa">
        <h4>HPA</h4>
        <dl>
          <div v-if="profile.hpa_reliability"><dt>Reliability</dt><dd>{{ profile.hpa_reliability }}</dd></div>
          <div v-if="subcellular.length"><dt>Localization</dt><dd>{{ subcellular.join(', ') }}</dd></div>
          <div v-if="rnaTissues.length"><dt>RNA tissues</dt><dd>{{ rnaTissues.length }}</dd></div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ profile: { type: Object, required: true } })

const usis = computed(() => props.profile.usis || [])
const subcellular = computed(() => props.profile.subcellular || [])
const rnaTissues = computed(() => {
  try { return Object.keys(JSON.parse(props.profile.rna_tissues_json || '{}')) } catch { return [] }
})
const hasHpa = computed(() => props.profile.hpa_reliability || subcellular.value.length || rnaTissues.value.length)
const agreement = computed(() => {
  try { return JSON.parse(props.profile.agreement_summary_json || 'null') } catch { return null }
})
</script>

<style scoped>
.compass-card { border: 1px solid var(--border, #e2e5ea); border-radius: 10px; padding: 16px; background: var(--card, #fff); }
.cc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
.cc-acc { font-weight: 700; font-size: 18px; }
.cc-gene { margin-left: 8px; color: var(--muted, #6b7280); font-weight: 600; }
.cc-badges { display: flex; gap: 8px; align-items: center; }
.cc-tier { font-weight: 700; padding: 2px 8px; border-radius: 6px; background: #eef2ff; color: #3730a3; }
.cc-tier.tier-T1 { background: #dcfce7; color: #166534; }
.cc-tier.tier-T4 { background: #fef3c7; color: #92400e; }
.cc-tier.tier-T6 { background: #f3f4f6; color: #6b7280; }
.cc-hpp { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: #ecfeff; color: #155e75; }
.cc-banner { font-size: 13px; padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; background: #f8fafc; color: #475569; }
.cc-banner.concordant { background: #f0fdf4; color: #15803d; }
.cc-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.cc-col { border: 1px solid var(--border, #eef0f3); border-radius: 8px; padding: 10px; }
.cc-col h4 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted, #6b7280); }
.cc-yes { font-weight: 700; color: #166534; margin-bottom: 4px; }
.cc-no { color: #9ca3af; }
dl { margin: 0; } dl > div { display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; }
dt { color: var(--muted, #6b7280); } dd { margin: 0; font-weight: 600; }
.cc-usis { margin-top: 6px; } .cc-usis-label { font-size: 12px; color: var(--muted, #6b7280); }
.cc-usis code { display: block; font-size: 11px; word-break: break-all; color: #334155; }
</style>
