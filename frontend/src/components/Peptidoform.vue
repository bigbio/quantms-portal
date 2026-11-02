<template>
  <span v-if="parsed" class="pf" :aria-label="value"
    ><span v-for="(m, k) in parsed.nterm" :key="`n${k}`" class="pf-term" :style="{ '--pf': m.color }" :title="`N-term · ${label(m)}`"></span
    ><span
      v-for="(r, k) in parsed.residues"
      :key="k"
      :class="{ 'pf-mod': r.mods.length }"
      :style="r.mods.length ? { '--pf': r.mods[0].color } : null"
      :title="r.mods.length ? `${r.aa}${k + 1} · ${r.mods.map(label).join(' + ')}` : null"
    >{{ r.aa }}</span
    ><span v-for="(m, k) in parsed.cterm" :key="`c${k}`" class="pf-term" :style="{ '--pf': m.color }" :title="`C-term · ${label(m)}`"></span
  ></span>
  <span v-else class="pf">{{ value }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { parsePeptidoform } from '../utils/peptidoform.js'

const props = defineProps({ value: { type: String, default: '' } })
const parsed = computed(() => parsePeptidoform(props.value))
const label = (m) => (m.unimod && m.unimod !== m.name ? `${m.name} (${m.unimod})` : m.name)
</script>

<style scoped>
.pf {
  font-family: var(--mono);
  font-size: 13px;
  white-space: nowrap;
}
.pf-mod {
  font-weight: 600;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--pf) 22%, transparent);
  box-shadow: inset 0 -2px 0 var(--pf);
  border-radius: 2px;
  padding: 0 1px;
}
.pf-term {
  display: inline-block;
  width: 5px;
  height: 1em;
  margin: 0 2px;
  vertical-align: -0.15em;
  border-radius: 2px;
  background: var(--pf);
}
</style>
