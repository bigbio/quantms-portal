// ProForma peptidoforms as written by qpx: "[UNIMOD:737]-PEPM[Oxidation]K-[Amidated]".

// UNIMOD ids seen in qpx data, by name; anything else keeps its tag.
const UNIMOD_NAMES = {
  1: 'Acetyl', 4: 'Carbamidomethyl', 5: 'Carbamyl', 7: 'Deamidated', 21: 'Phospho', 26: 'Pyro-carbamidomethyl',
  27: 'Glu->pyro-Glu', 28: 'Gln->pyro-Glu', 34: 'Methyl', 35: 'Oxidation', 36: 'Dimethyl', 37: 'Trimethyl',
  39: 'Methylthio', 40: 'Sulfo', 121: 'GG', 188: 'Label:13C(6)', 199: 'Dimethyl:2H(4)', 214: 'iTRAQ4plex',
  259: 'Label:13C(6)15N(2)', 267: 'Label:13C(6)15N(4)', 385: 'Ammonia-loss', 730: 'iTRAQ8plex',
  737: 'TMT6plex', 2016: 'TMTpro',
}

// Fixed colour per modification family, so a modification looks the same in every dataset.
const FAMILIES = [
  { key: 'phospho', test: /^phospho/i, color: 'var(--cat-8)' },
  { key: 'oxidation', test: /^(oxidation|dioxidation)/i, color: 'var(--cat-2)' },
  { key: 'acetyl', test: /^acetyl/i, color: 'var(--cat-7)' },
  { key: 'deamidation', test: /^deamidat/i, color: 'var(--cat-4)' },
  { key: 'ubiquitin', test: /^(gg|glygly)$/i, color: 'var(--cat-6)' },
  { key: 'methyl', test: /^(methyl|dimethyl|trimethyl)$/i, color: 'var(--cat-5)' },
  { key: 'isobaric', test: /^(tmt|itraq)/i, color: 'var(--cat-1)' },
  { key: 'silac', test: /^(label:|dimethyl:)/i, color: 'var(--cat-3)' },
  { key: 'fixed', test: /^carbamidomethyl$/i, color: 'var(--text-muted)' },
]
const OTHER = { key: 'other', color: 'var(--text-secondary)' }

export function modInfo(tag) {
  const raw = String(tag)
  const m = raw.match(/^unimod:(\d+)$/i)
  const name = m ? UNIMOD_NAMES[m[1]] || raw : raw
  const family = FAMILIES.find((f) => f.test.test(name)) || OTHER
  return { tag: raw, name, unimod: m ? `UNIMOD:${m[1]}` : '', family: family.key, color: family.color }
}

const CLOSE = { '[': ']', '(': ')' }

// Bracketed tags, allowing nested brackets inside a tag (e.g. "Label:13C(6)").
function readTags(s, i) {
  const tags = []
  while (CLOSE[s[i]]) {
    const open = s[i]
    let depth = 0
    let j = i
    for (; j < s.length; j++) {
      if (s[j] === open) depth++
      else if (s[j] === CLOSE[open] && --depth === 0) break
    }
    if (j >= s.length) return null
    tags.push(s.slice(i + 1, j))
    i = j + 1
  }
  return { tags, next: i }
}

// { nterm: [mod], residues: [{ aa, mods: [mod] }], cterm: [mod] }, or null when it is not a peptidoform.
// Reads ProForma ("[Acetyl]-PEPM[Oxidation]K-[Amidated]") and OpenMS (".(Acetyl)PEPM(Oxidation)K.(Amidated)").
export function parsePeptidoform(pf) {
  if (typeof pf !== 'string' || !pf) return null
  const s = pf.trim()
  let i = 0
  let nterm = []
  if (s[0] === '.' || s[0] === '(') {
    const r = readTags(s, s[0] === '.' ? 1 : 0)
    if (!r) return null
    nterm = r.tags
    i = r.next
  } else if (s[0] === '[') {
    const r = readTags(s, 0)
    if (!r || s[r.next] !== '-') return null
    nterm = r.tags
    i = r.next + 1
  }
  const residues = []
  let cterm = []
  while (i < s.length) {
    const c = s[i]
    if ((c === '-' && s[i + 1] === '[') || c === '.') {
      const r = readTags(s, i + 1)
      if (!r || r.next !== s.length) return null
      cterm = r.tags
      break
    }
    if (!/[A-Z]/.test(c)) return null
    const r = readTags(s, i + 1)
    if (!r) return null
    residues.push({ aa: c, mods: r.tags.map(modInfo) })
    i = r.next
  }
  if (!residues.length) return null
  return { nterm: nterm.map(modInfo), residues, cterm: cterm.map(modInfo) }
}

// Distinct modifications across peptidoforms, most frequent first: [{ name, color, family, count }].
export function modsInPeptidoforms(list) {
  const seen = new Map()
  for (const pf of list) {
    const p = parsePeptidoform(pf)
    if (!p) continue
    for (const m of [...p.nterm, ...p.residues.flatMap((r) => r.mods), ...p.cterm]) {
      const e = seen.get(m.name) || { ...m, count: 0 }
      e.count++
      seen.set(m.name, e)
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count)
}
