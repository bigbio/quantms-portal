// Data shaping for the home page charts and the protein spotlight.
import { cleanInstrument } from './format.js'

// Top `n` rows of a stats.json list as { label, value, share } bars, share relative to the largest.
export function barRows(list, labelKey, n = 6, labelFn = (s) => s) {
  const rows = (Array.isArray(list) ? list : [])
    .filter((r) => r && Number(r.datasets) > 0)
    .sort((a, b) => b.datasets - a.datasets)
    .slice(0, n)
  const max = rows.length ? rows[0].datasets : 1
  return rows.map((r) => ({ label: labelFn(r[labelKey]), value: r.datasets, share: r.datasets / max }))
}

// Proteins the spotlight rotates through: well known, widely observed, with biology worth a look.
export const SPOTLIGHT_PROTEINS = [
  { accession: 'P02768', note: 'The most abundant protein in blood plasma.' },
  { accession: 'P04637', note: 'Tumour suppressor; its gene is the most frequently mutated in human cancer.' },
  { accession: 'P00533', note: 'Growth-factor receptor and the target of several cancer drugs.' },
  { accession: 'P04406', note: 'Glycolysis enzyme, widely used as a loading control.' },
  { accession: 'P68871', note: 'The beta chain of haemoglobin, which carries oxygen in red blood cells.' },
  { accession: 'P10636', note: 'Tau; its hyperphosphorylated form builds the tangles seen in Alzheimer disease.' },
  { accession: 'P05067', note: 'Amyloid precursor protein, the source of amyloid-beta in Alzheimer disease.' },
  { accession: 'P07900', note: 'Chaperone that helps hundreds of other proteins fold.' },
  { accession: 'P02751', note: 'Fibronectin, extracellular-matrix glue for cell adhesion and wound healing.' },
  { accession: 'P60709', note: 'Beta-actin, a core part of the cytoskeleton in nearly every cell.' },
  { accession: 'P38398', note: 'DNA-repair protein; inherited mutations raise breast and ovarian cancer risk.' },
]

// One protein per day, the same for every visitor on that day.
export function spotlightIndex(date = new Date(), n = SPOTLIGHT_PROTEINS.length) {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000)
  return day % n
}

// The facts the spotlight card shows, from a /protein/profile response.
export function spotlightFacts(p) {
  if (!p || !p.found) return null
  const tissues = (p.tissues || [])
    .filter((t) => t.value && !/^(not available|unknown|norm)$/i.test(t.value))
    .sort((a, b) => b.n_datasets - a.n_datasets)
    .slice(0, 6)
  const max = tissues.length ? tissues[0].n_datasets : 1
  return {
    accession: p.query,
    gene: p.gene || '',
    name: p.name || p.query,
    coverage: p.coverage_pct ?? null,
    peptides: p.n_peptides || 0,
    datasets: p.n_datasets || 0,
    nTissues: (p.tissues || []).length,
    tissues: tissues.map((t) => ({ label: t.value, value: t.n_datasets, share: t.n_datasets / max })),
    ptms: (p.ptms || []).filter((m) => m.is_biological).sort((a, b) => b.n_datasets - a.n_datasets).slice(0, 5)
      .map((m) => ({ site: m.site, datasets: m.n_datasets })),
  }
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const isKnown = (s) => s && !/^(none|unknown|not available|not applicable)$/i.test(s)

function countRows(counts, n) {
  return barRows([...counts].map(([label, datasets]) => ({ label, datasets })), 'label', n)
}

// Per-dataset breakdowns from the dataset-search catalogue, so they add up to the catalogue's dataset count.
export function catalogueBreakdowns(datasets, n = 6) {
  const organisms = new Map()
  const species = new Set()
  const tissues = new Map()
  const instruments = new Map()
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1)
  for (const d of datasets || []) {
    const orgs = String(d.organism ?? '').split(';').map((s) => s.trim()).filter(isKnown)
    orgs.forEach((o) => species.add(o.toLowerCase()))
    if (orgs.length) bump(organisms, orgs.length > 1 ? `Mixed (${orgs.length} organisms)` : capitalize(orgs[0]))
    for (const t of new Set((d.tissues || []).filter(isKnown))) bump(tissues, capitalize(t))
    const inst = cleanInstrument(d.instrument)
    if (isKnown(inst)) bump(instruments, inst)
  }
  return {
    organisms: countRows(organisms, n),
    tissues: countRows(tissues, n),
    instruments: countRows(instruments, n),
    nOrganisms: species.size,
  }
}
