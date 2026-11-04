import { describe, it, expect } from 'vitest'
import { field, fold, matchFields, queryTerms } from './catalogueSearch.js'

const fields = [
  ...field('accession', 10, true, 'MSV000085836'),
  ...field('title', 6, true, 'Quantitative Proteomics of the Cancer Cell Line Encyclopedia'),
  ...field('organism', 4, false, ['Human', 'Mammals']),
  ...field('tissue', 5, false, ['liver', 'lung']),
  ...field('description', 1, false, 'Proteins of 375 cell lines across diverse lineages were quantified with TMT 10-plex reagents and deep fractionation.'),
]

describe('catalogue search', () => {
  it('splits a query into folded terms and quoted phrases', () => {
    expect(fold('Münster – HLA')).toBe('munster - hla')
    expect(queryTerms('  Human "cell line"  TMT ')).toEqual(['human', 'cell line', 'tmt'])
  })

  it('needs every term somewhere and ranks fields by weight', () => {
    expect(matchFields(fields, ['cancer', 'zebrafish'])).toBeNull()
    expect(matchFields(fields, ['human', 'liver']).score).toBeGreaterThan(0)
    const title = matchFields(fields, ['cancer']).score
    const description = matchFields(fields, ['fractionation']).score
    expect(title).toBeGreaterThan(description)
    // a whole accession outranks part of one
    expect(matchFields(fields, ['msv000085836']).score).toBeGreaterThan(matchFields(fields, ['msv0000858']).score)
  })

  it('finds an accession typed in part or without its zeros', () => {
    for (const t of ['msv0000858', '85836', 'msv85836', 'msv8583']) expect(matchFields(fields, [t])).not.toBeNull()
    expect(matchFields(fields, ['msv85837'])).toBeNull()
    expect(matchFields(fields, ['pxd85836'])).toBeNull()
  })

  it('notes where terms off the row were found', () => {
    expect(matchFields(fields, ['cancer']).notes).toEqual([])
    expect(matchFields(fields, ['human', 'liver']).notes).toEqual([
      { name: 'organism', parts: ['', 'Human', ''] },
      { name: 'tissue', parts: ['', 'liver', ''] },
    ])
    const [n] = matchFields(fields, ['10-plex']).notes
    expect(n.name).toBe('description')
    expect(n.parts[1]).toBe('10-plex')
    expect(n.parts[0].startsWith('…')).toBe(true)
  })
})
