// Colours for samples by a biological annotation (tissue, disease, cell type, ...),
// shared by every Explorer chart that shows samples or single-sample runs. A value
// keeps its colour across the page and, where it belongs to a biological group,
// across the portal: the group (organ system, disease class, taxonomic group) gives
// the hue, the same as on the Statistics and protein pages, and its members within
// one dataset take lighter and darker shades of it.
import { ref, watch } from 'vue'
import { CATEGORICAL, chartColor, ramp, shades } from './utils/chartColors.js'
import { diseaseGroup, DISEASE_GROUPS, ORGAN_SYSTEMS, organSystem, TAXON_GROUPS, taxonGroup } from './chartGroups.js'

// Sample annotations worth colouring by, in order of preference for the default.
export const COLOUR_FIELDS = [
  ['organism_part', 'Organism part'],
  ['disease', 'Disease'],
  ['cell_type', 'Cell type'],
  ['sex', 'Sex'],
  ['developmental_stage', 'Developmental stage'],
  ['cell_line', 'Cell line'],
  ['sampling_site', 'Sampling site'],
  ['organism', 'Organism'],
]

// Fields whose values belong to a biological group, the groups in legend order,
// and how a value's group is found (async lookups hit UBERON or UniProt).
export const GROUPED_FIELDS = {
  organism_part: { groups: ORGAN_SYSTEMS, lookup: organSystem, source: 'organ system (UBERON)' },
  sampling_site: { groups: ORGAN_SYSTEMS, lookup: organSystem, source: 'organ system (UBERON)' },
  cell_type: { groups: ORGAN_SYSTEMS, lookup: organSystem, source: 'organ system (UBERON and CL)' },
  disease: { groups: DISEASE_GROUPS, lookup: async (v) => diseaseGroup(v), source: 'disease class' },
  organism: { groups: TAXON_GROUPS, lookup: taxonGroup, source: 'taxonomic group (UniProt)' },
}

// Ordered stages, earliest first; a stage matching none goes last.
const STAGES = [/embryo/i, /fet(al|us)/i, /neonat|newborn/i, /infant/i, /child/i, /juvenile/i, /adolescen/i, /adult/i, /aged|elderly|old/i]
const stageRank = (v) => {
  const i = STAGES.findIndex((re) => re.test(v))
  return i < 0 ? STAGES.length : i
}

// Fixed colours where a field has a small closed set of values.
const FIXED = { sex: { female: CATEGORICAL[6], male: CATEGORICAL[2] } }

const UNANNOTATED = /^(not applicable|not available|unknown|pooled|none|n\/a|na)$/i
export const NOT_ANNOTATED = 'Not annotated'
export const OTHER = 'Other'
const NOT_ANNOTATED_COLOUR = '#d5dae0'
// Up to this many values each make a group of their own in the charts;
// past it, values are grouped by their biological group.
const MAX_SPLITS = 8

export function annotation(sample, field) {
  const v = sample ? sample[field] : null
  return v == null || String(v).trim() === '' || UNANNOTATED.test(String(v).trim()) ? null : String(v)
}

// Every annotation with at least two values: [{ key, title, distinct, annotated }].
// `groups` is false when most values are unique (one cell line per sample), so
// the field names samples rather than groups them.
export function annotationFields(samples) {
  return COLOUR_FIELDS.map(([key, title]) => {
    const values = samples.map((s) => annotation(s, key)).filter((v) => v != null)
    const distinct = new Set(values).size
    return { key, title, distinct, annotated: values.length, groups: distinct * 2 <= values.length }
  }).filter((f) => f.distinct > 1)
}

// The fields samples can be coloured by.
export const colourFields = (samples) => annotationFields(samples).filter((f) => f.groups)

function countValues(samples, field) {
  const counts = new Map()
  let missing = 0
  for (const s of samples) {
    const v = annotation(s, field)
    if (v == null) missing++
    else counts.set(v, (counts.get(v) || 0) + 1)
  }
  return { counts, missing }
}

const byCount = ([a, n], [b, m]) => m - n || a.localeCompare(b)

// The colour scale of one field. `groupOf` maps a value to its biological group
// ({ group, colour }) for the fields in GROUPED_FIELDS; without it (lookup not
// done or failed) values are ranked by count instead.
//   colourOf(v)  colour of a value (null: not annotated)
//   splitOf(v)   the group a value is drawn in: the value itself, or its
//                biological group when there are too many values
//   splits       those groups in order: [{ label, colour, n }]
//   legend       what the legend lists: [{ label, colour, n, family? }]
//   values       values for a chart of the field, at most 12 plus "Other"
//   matches(v, h) whether a value belongs to the highlighted legend entry
export function colourScale(samples, field, groupOf = null) {
  const { counts, missing } = countValues(samples, field)
  const ranked = [...counts].sort(byCount)
  const grouped = GROUPED_FIELDS[field]
  let colours
  let family = () => null
  let splits

  if (grouped && groupOf) {
    // hue = biological group (in the group table's order, grey groups last), shade = value
    const order = (g) => {
      const i = grouped.groups.findIndex((x) => x.label === g)
      return i < 0 ? grouped.groups.length : i
    }
    const fams = new Map()
    for (const [v, n] of ranked) {
      const g = groupOf(v)
      if (!fams.has(g.group)) fams.set(g.group, { label: g.group, colour: g.colour, n: 0, members: [] })
      const f = fams.get(g.group)
      f.n += n
      f.members.push([v, n])
    }
    const families = [...fams.values()].sort((a, b) => order(a.label) - order(b.label) || a.label.localeCompare(b.label))
    colours = new Map()
    const familyOf = new Map()
    for (const f of families) {
      const tones = shades(f.colour, f.members.length)
      f.members.forEach(([v], i) => { colours.set(v, tones[i]); familyOf.set(v, f.label) })
    }
    family = (v) => familyOf.get(v) ?? null
    splits = ranked.length <= MAX_SPLITS
      ? families.flatMap((f) => f.members.map(([v, n]) => ({ label: v, colour: colours.get(v), n, family: f.label })))
      : families.map(({ label, colour, n }) => ({ label, colour, n }))
  } else if (field === 'developmental_stage') {
    const ordered = [...counts].sort(([a], [b]) => stageRank(a) - stageRank(b) || a.localeCompare(b))
    const tones = ramp(ordered.length)
    colours = new Map(ordered.map(([v], i) => [v, tones[i]]))
    splits = ordered.map(([v, n]) => ({ label: v, colour: colours.get(v), n }))
  } else {
    // fixed colours first, then the palette slots left, by count; past eight, "Other"
    const fixed = FIXED[field] || {}
    const fixedOf = (v) => fixed[v.toLowerCase()]
    const free = CATEGORICAL.filter((c) => !Object.values(fixed).includes(c))
    const open = ranked.filter(([v]) => !fixedOf(v))
    const room = ranked.length > CATEGORICAL.length ? free.length - 1 : free.length
    colours = new Map([
      ...ranked.filter(([v]) => fixedOf(v)).map(([v]) => [v, fixedOf(v)]),
      ...open.slice(0, room).map(([v], i) => [v, free[i]]),
    ])
    splits = ranked.filter(([v]) => colours.has(v)).map(([v, n]) => ({ label: v, colour: colours.get(v), n }))
    const rest = ranked.filter(([v]) => !colours.has(v))
    if (rest.length) splits.push({ label: `${OTHER} (${rest.length})`, colour: chartColor('other'), n: rest.reduce((a, [, n]) => a + n, 0), other: true })
  }

  const other = splits.find((s) => s.other)
  const colourOf = (v) => (v == null ? NOT_ANNOTATED_COLOUR : colours.get(v) || chartColor('other'))
  const splitOf = (v) => {
    if (v == null) return NOT_ANNOTATED
    if (splits.some((s) => s.label === v && !s.other)) return v
    return family(v) ?? other?.label
  }
  const rankOf = (v) => {
    const i = splits.findIndex((s) => s.label === splitOf(v))
    return i < 0 ? splits.length : i
  }
  const legend = missing ? [...splits, { label: NOT_ANNOTATED, colour: NOT_ANNOTATED_COLOUR, n: missing, missing: true }] : splits
  const matches = (v, h) => splitOf(v) === h || family(v) === h

  // A chart of the field: the twelve commonest values (those with a colour of their
  // own when colours go by rank), in legend order.
  const shown = grouped && groupOf ? ranked.slice(0, 12) : ranked.filter(([v]) => colours.has(v)).slice(0, 12)
  const top = new Set(shown.map(([v]) => v))
  const values = [...counts].filter(([v]) => top.has(v))
    .sort(([a, n], [b, m]) => rankOf(a) - rankOf(b) || m - n)
    .map(([v, n]) => ({ label: v, colour: colourOf(v), n }))
  const rest = ranked.filter(([v]) => !top.has(v))
  if (rest.length) {
    values.push({ label: `${OTHER} (${rest.length})`, colour: chartColor('other'), n: rest.reduce((a, [, n]) => a + n, 0) })
  }
  if (missing) values.push({ label: NOT_ANNOTATED, colour: NOT_ANNOTATED_COLOUR, n: missing })

  return { field, colourOf, splitOf, family, splits, legend, values, rankOf, matches, grouped: !!(grouped && groupOf) }
}

// Looks up the biological group of every value of the grouped fields the samples
// can be coloured by. Per field: { status: 'pending' | 'ready', groupOf, failed },
// where `failed` counts values whose lookup could not be made (drawn grey).
// The ontology services answer one name per request and slowly, so the field the
// page is coloured by goes first and the others follow one at a time.
export function useSampleGroups(samplesGetter, firstGetter) {
  const state = ref({})
  let current = null
  let started = new Set()

  function start(samples, key) {
    if (samples !== current || started.has(key) || !state.value[key]) return Promise.resolve()
    started.add(key)
    const values = [...new Set(samples.map((s) => annotation(s, key)).filter((v) => v != null))]
    return Promise.allSettled(values.map((v) => GROUPED_FIELDS[key].lookup(v))).then((results) => {
      if (samples !== current) return
      const unknown = { group: LOOKUP_FAILED, colour: chartColor('other') }
      const map = new Map(values.map((v, i) => [v, results[i].status === 'fulfilled' ? results[i].value : unknown]))
      const failed = results.filter((r) => r.status === 'rejected').length
      state.value = { ...state.value, [key]: { status: 'ready', groupOf: (v) => map.get(v) || unknown, failed } }
    })
  }

  watch(samplesGetter, async (samples) => {
    current = samples
    started = new Set()
    const keys = colourFields(samples).map((f) => f.key).filter((k) => GROUPED_FIELDS[k])
    state.value = Object.fromEntries(keys.map((k) => [k, { status: 'pending', groupOf: null, failed: 0 }]))
    const first = firstGetter()
    await start(samples, keys.includes(first) ? first : keys[0])
    for (const k of keys) await start(samples, k)
  }, { immediate: true })
  watch(firstGetter, (k) => { if (current) start(current, k) })
  return state
}
export const LOOKUP_FAILED = 'Lookup failed'

// The annotation of a run: its samples' value when they share one (always so for
// a label-free run), `mixed` when a multiplexed run holds several. Pooled
// references (no value) do not make a run mixed.
export function runAnnotation(sampleAccessions, sampleById, field) {
  const values = new Set(sampleAccessions.map((a) => annotation(sampleById.get(a), field)).filter((v) => v != null))
  if (values.size > 1) return { mixed: true, value: null }
  return { mixed: false, value: values.size ? [...values][0] : null }
}
