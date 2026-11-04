// Search of the dataset catalogue. Every term of the query has to occur in some
// field of a dataset; the dataset scores by the fields its terms occur in, so an
// accession or a title word outranks a word deep in the description.

// Lower case, accents dropped, dash variants as "-".
export const fold = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[‐-―−]/g, '-').toLowerCase()

// The terms of a query; "quoted words" stay one phrase.
export const queryTerms = (q) => [...fold(q).matchAll(/"([^"]*)"|(\S+)/g)].map((m) => (m[1] ?? m[2]).trim()).filter(Boolean)

// Searchable values of one kind. `shown` fields are on the table row, so a match
// there explains itself; a match elsewhere is noted under the row.
export const field = (name, weight, shown, values) => [values].flat().filter(Boolean)
  .map((v) => ({ name, weight, shown, text: String(v), folded: fold(v) }))

// An accession typed in part or without its leading zeros: MSV0000858, pxd48538.
const ACCESSION = /^([a-z]+)0*(\d+)$/
function accessionMatch(term, accession) {
  const t = term.match(ACCESSION)
  const a = accession.match(ACCESSION)
  return !!t && !!a && t[1] === a[1] && a[2].startsWith(t[2])
}

const wordStart = (text, term) => {
  for (let at = text.indexOf(term); at >= 0; at = text.indexOf(term, at + 1)) {
    if (at === 0 || !/[a-z0-9]/.test(text[at - 1])) return true
  }
  return false
}

// A whole field counts three times its weight, a word start twice, inside a word once.
function termScore(f, term) {
  if (!f.folded.includes(term)) return f.name === 'accession' && accessionMatch(term, f.folded) ? f.weight * 2 : 0
  if (f.folded === term) return f.weight * 3
  return f.weight * (wordStart(f.folded, term) ? 2 : 1)
}

// The matched value, a long one cut to a window around the term: [before, hit, after].
function note(f, term) {
  const at = f.text.toLowerCase().indexOf(term)
  if (at < 0) return { name: f.name, parts: [f.text.length > 90 ? `${f.text.slice(0, 90)}…` : f.text, '', ''] }
  let before = f.text.slice(0, at)
  let after = f.text.slice(at + term.length)
  if (before.length > 40) before = `…${before.slice(-40).replace(/^\S*\s/, '')}`
  if (after.length > 50) after = `${after.slice(0, 50).replace(/\s\S*$/, '')}…`
  return { name: f.name, parts: [before, f.text.slice(at, at + term.length), after] }
}

// null when a term occurs in no field, else { score, notes }: notes say where the
// terms not visible on the row were found (a tissue, a keyword, the summary).
export function matchFields(fields, terms) {
  let score = 0
  const notes = []
  const noted = new Set()
  for (const term of terms) {
    let best = null
    for (const f of fields) {
      const s = termScore(f, term)
      if (s > (best ? best.s : 0)) best = { s, f }
    }
    if (!best) return null
    score += best.s
    if (!best.f.shown && !noted.has(best.f)) {
      noted.add(best.f)
      notes.push(note(best.f, term))
    }
  }
  return { score, notes }
}
