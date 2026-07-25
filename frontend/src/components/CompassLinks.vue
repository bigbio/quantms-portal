<template>
  <span class="compass-links">
    <router-link :to="quantmsPeptideSearchPath(acc)" class="rlink">quantms</router-link> ·
    <a :href="peptideAtlasUrl(acc)" target="_blank" rel="noopener" class="rlink">PA</a> ·
    <a :href="uniprotUrl(acc)" target="_blank" rel="noopener" class="rlink">UniProt</a>
  </span>
</template>

<script setup>
import { uniprotUrl, peptideAtlasUrl, quantmsPeptideSearchPath } from '../utils/links.js'

defineProps({ acc: { type: String, required: true } })
</script>

<style scoped>
.rlink { color: #4f46e5; text-decoration: none; font-weight: 600; }
.rlink:hover { text-decoration: underline; }
</style>
