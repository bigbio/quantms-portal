import { describe, it, expect } from 'vitest'
import { uniprotUrl, peptideAtlasUrl, quantmsPeptideSearchPath, safeHref } from './links.js'

describe('cross-resource link builders', () => {
  it('builds a UniProt entry URL and encodes the accession', () => {
    expect(uniprotUrl('P04637')).toBe('https://www.uniprot.org/uniprotkb/P04637/entry')
    // special characters must be encoded, never break the URL
    expect(uniprotUrl('P0 X/2')).toContain(encodeURIComponent('P0 X/2'))
    expect(uniprotUrl('P0 X/2')).not.toContain(' ')
  })

  it('builds a PeptideAtlas search URL with an encoded accession', () => {
    expect(peptideAtlasUrl('P04637')).toContain('search_key=P04637')
    expect(peptideAtlasUrl('A B')).toContain('search_key=A%20B')
  })

  it('builds an internal peptide-search route path with an encoded query', () => {
    expect(quantmsPeptideSearchPath('P04637')).toBe(
      '/apps/peptide-search?mode=protein&query=P04637',
    )
    expect(quantmsPeptideSearchPath('P0/2')).toContain('query=P0%2F2')
  })
})

describe('safeHref', () => {
  it('keeps absolute http(s) URLs', () => {
    expect(safeHref('https://www.ebi.ac.uk/pride/archive/projects/PXD000561')).toBe('https://www.ebi.ac.uk/pride/archive/projects/PXD000561')
    expect(safeHref(' http://example.org/a ')).toBe('http://example.org/a')
  })
  it('drops script, data, relative and malformed values', () => {
    expect(safeHref('javascript:alert(1)')).toBe('')
    expect(safeHref('JavaScript:alert(1)')).toBe('')
    expect(safeHref('data:text/html,hi')).toBe('')
    expect(safeHref('/relative/path')).toBe('')
    expect(safeHref('not a url')).toBe('')
    expect(safeHref(null)).toBe('')
    expect(safeHref(42)).toBe('')
  })
})
