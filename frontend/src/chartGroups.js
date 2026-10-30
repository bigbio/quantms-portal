// Groups that colour the portal's charts by what the bars are: organisms by
// taxonomic lineage (UniProt taxonomy) and tissues by organ system (UBERON, via
// the EBI Ontology Lookup Service), both looked up live by name so a new
// organism or tissue needs no table; instruments by mass analyser.
import { ref, watch } from 'vue'
import { CATEGORICAL, chartColor } from './utils/chartColors.js'

const UNIPROT_TAXONOMY = 'https://rest.uniprot.org/taxonomy/search'
const OLS = 'https://www.ebi.ac.uk/ols4/api'

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

// Palette slots by name. Groups take the hue they are associated with where one
// exists (blood red, plants green), fixed whatever the data holds; the slot pairs
// colour-blind readers confuse most (red/orange, blue/purple) go to related groups.
const [BLUE, ORANGE, GREEN, YELLOW, PINK, DARK_GREEN, PURPLE, RED] = CATEGORICAL
const withColours = (groups) => groups.map((g, i) => ({ colour: CATEGORICAL[i], ...g }))
const grey = (group, extra) => ({ group, colour: chartColor('other'), ...extra })

// Looked-up groups are kept in the browser between visits (without their colour,
// which comes from the tables below), so a page shows them at once next time.
const STORE = 'chart-groups:1'
function stored(key) {
  try { return JSON.parse(localStorage.getItem(`${STORE}:${key}`)) } catch { return null }
}
function store(key, value) {
  try { localStorage.setItem(`${STORE}:${key}`, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}

// One lookup per name; a failed one is tried again next time.
function cached(kind, lookup, colourOf) {
  const cache = new Map()
  return (name) => {
    if (!cache.has(name)) {
      const hit = stored(`${kind}:${name}`)
      const found = hit ? Promise.resolve(hit) : lookup(name).then((g) => { store(`${kind}:${name}`, g); return g })
      cache.set(name, found.then((g) => ({ ...g, colour: colourOf(g.group) })).catch((e) => { cache.delete(name); throw e }))
    }
    return cache.get(name)
  }
}
const colourIn = (groups) => (label) => groups.find((g) => g.label === label)?.colour || chartColor('other')

// --- organisms ------------------------------------------------------------------

// The first group with a taxon in the organism's lineage wins, so narrower groups come first.
export const TAXON_GROUPS = [
  { label: 'Mammals', taxa: ['Mammalia'], colour: BLUE },
  { label: 'Other vertebrates', taxa: ['Vertebrata'], colour: PURPLE },
  { label: 'Invertebrates', taxa: ['Metazoa'], colour: ORANGE },
  { label: 'Plants and green algae', taxa: ['Viridiplantae'], colour: DARK_GREEN },
  { label: 'Fungi', taxa: ['Fungi'], colour: YELLOW },
  { label: 'Other eukaryotes', taxa: ['Eukaryota'], colour: PINK },
  { label: 'Bacteria and archaea', taxa: ['Bacteria', 'Archaea'], colour: GREEN },
  { label: 'Viruses', taxa: ['Viruses'], colour: RED },
]
export const SEVERAL_ORGANISMS = 'Several organisms'
export const NOT_IN_UNIPROT = 'Not found in UniProt'

async function taxon(query) {
  const params = new URLSearchParams({ query, fields: 'scientific_name,lineage', format: 'json', size: '1' })
  return (await getJSON(`${UNIPROT_TAXONOMY}?${params}`)).results[0] || null
}

// { group, colour, match }: `match` is the UniProt taxon the name was matched to.
// An entry listing several organisms ("A; B; C") belongs to no one group.
export const taxonGroup = cached('taxon', async (name) => {
  if (name.includes(';')) return { group: SEVERAL_ORGANISMS }
  const hit = (await taxon(`scientific:"${name}"`)) || (await taxon(`"${name}"`))
  if (!hit) return { group: NOT_IN_UNIPROT }
  const lineage = new Set([hit.scientificName, ...hit.lineage.map((l) => l.scientificName)])
  const g = TAXON_GROUPS.find((x) => x.taxa.some((t) => lineage.has(t)))
  return g ? { group: g.label, match: hit.scientificName } : { group: NOT_IN_UNIPROT }
}, colourIn(TAXON_GROUPS))

// --- tissues --------------------------------------------------------------------

// UBERON terms (and the haematopoietic cell, from CL) whose parts make up each group;
// the first group a tissue belongs to wins (liver: digestive before endocrine).
export const ORGAN_SYSTEMS = [
  { label: 'Blood and immune system', ids: ['UBERON:0002193', 'CL:0000988'], colour: RED },
  { label: 'Nervous system', ids: ['UBERON:0001016'], colour: YELLOW },
  { label: 'Digestive system', ids: ['UBERON:0001007'], colour: GREEN },
  { label: 'Cardiovascular system', ids: ['UBERON:0004535'], colour: ORANGE },
  { label: 'Respiratory system', ids: ['UBERON:0001004'], colour: BLUE },
  { label: 'Reproductive and urinary systems', ids: ['UBERON:0000990', 'UBERON:0001008'], colour: PURPLE },
  { label: 'Endocrine system', ids: ['UBERON:0000949'], colour: PINK },
  { label: 'Cells and cell culture', ids: [], colour: DARK_GREEN },
]
const CELLS = ORGAN_SYSTEMS.at(-1)
// a system outside the groups above (skin, muscle, ...) or none in UBERON (pancreas, adipose tissue)
export const NO_SYSTEM = 'Other or no organ system'
export const NOT_IN_UBERON = 'Not found in UBERON'

const norm = (s) => s.toLowerCase().replace(/[\s_-]+/g, '')
const labelOf = (e) => [e.label].flat()[0]
const curie = (iri) => iri.split('/').pop().replace('_', ':')

// Exact label or synonym matches, with their ancestors; the one whose label is
// the name itself first ("Brain" is also a synonym of an insect ganglion).
async function term(name, ontology) {
  const params = new URLSearchParams({ search: name, searchFields: 'label synonym', exactMatch: 'true', size: '20', lang: 'en' })
  const found = (await getJSON(`${OLS}/v2/ontologies/${ontology}/classes?${params}`)).elements
  return found.find((e) => norm(labelOf(e)) === norm(name)) || found[0] || null
}

// { group, colour, match }: `match` is the ontology term ("UBERON:0000955 brain").
// Cell types (CL, imported into UBERON) and cell cultures (BTO) are not anatomy,
// so they form their own group.
export const organSystem = cached('organ', async (name) => {
  const t = await term(name, 'uberon')
  if (!t) {
    const culture = await term(name, 'bto')
    return culture ? { group: CELLS.label, match: `${culture.curie} ${labelOf(culture)}` } : { group: NOT_IN_UBERON }
  }
  const match = `${t.curie} ${labelOf(t)}`
  const ids = new Set([t.curie, ...(t.hierarchicalAncestor || []).map(curie)])
  const sys = ORGAN_SYSTEMS.find((x) => x.ids.some((id) => ids.has(id)))
  if (sys) return { group: sys.label, match }
  if (t.curie.startsWith('CL:')) return { group: CELLS.label, match }
  return { group: NO_SYSTEM, match }
}, colourIn(ORGAN_SYSTEMS))

// --- diseases -------------------------------------------------------------------

// Disease annotations are free text ("normal", "covid-19", "breast adenocarcinoma"),
// so they are grouped by name: healthy or normal controls, cancers (in the lavender
// of cancer awareness), other diseases.
export const DISEASE_GROUPS = [
  { label: 'Healthy or normal', pattern: /^(normal|healthy|control|healthy control|uninfected)$/i, colour: GREEN },
  { label: 'Cancer', pattern: /cancer|carcinoma|tumou?r|neoplas|leuka?emia|lymphoma|sarcoma|melanoma|glioma|myeloma|blastoma|mesothelioma/i, colour: PURPLE },
  { label: 'Other disease', pattern: /./, colour: ORANGE },
]

export function diseaseGroup(name) {
  const g = DISEASE_GROUPS.find((x) => x.pattern.test(name))
  return { group: g.label, colour: g.colour }
}

// --- instruments ----------------------------------------------------------------

// Mass analyser of an instrument model, from its name; the first pattern that
// matches wins ("LTQ FT" is FT-ICR, "LTQ Orbitrap" an Orbitrap, a plain LTQ an ion trap).
export const ANALYSERS = withColours([
  { label: 'FT-ICR', pattern: /ft-?icr|ltq ft|solarix|apex/i },
  { label: 'Orbitrap and Astral', pattern: /astral/i },
  { label: 'Orbitrap', pattern: /orbitrap|q exactive|exploris/i },
  { label: 'Time-of-flight', pattern: /tof|synapt|maxis|impact|xevo g2/i },
  { label: 'Ion trap', pattern: /ltq|velos|ion trap|amazon|esquire/i },
  { label: 'Triple quadrupole', pattern: /tsq|qtrap|triple quad|xevo tq|altis/i },
])
export const OTHER_ANALYSER = 'Other or unknown'

export function analyserGroup(name) {
  const a = ANALYSERS.find((x) => x.pattern.test(name))
  return a ? { group: a.label, colour: a.colour } : grey(OTHER_ANALYSER)
}

// --- in components --------------------------------------------------------------

// Looks the names up as they change: `groups` maps each resolved name to its
// group, `failed` turns true when a lookup service could not be reached.
export function useGroups(names, lookup) {
  const groups = ref({})
  const failed = ref(false)
  watch(names, (list) => {
    for (const n of list) {
      if (groups.value[n]) continue
      lookup(n)
        .then((g) => { groups.value = { ...groups.value, [n]: g } })
        .catch(() => { failed.value = true })
    }
  }, { immediate: true })
  return { groups, failed }
}

// Legend for the groups present: palette groups in their fixed order, then the grey ones.
export function groupLegend(order, resolved) {
  const present = new Set(resolved.map((g) => g.group))
  const known = order.filter((g) => present.has(g.label)).map((g) => ({ label: g.label, colour: g.colour }))
  const greyGroups = [...present].filter((p) => !order.some((g) => g.label === p)).map((label) => ({ label, colour: chartColor('other') }))
  return [...known, ...greyGroups]
}
