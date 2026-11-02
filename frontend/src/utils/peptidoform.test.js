import { describe, it, expect } from 'vitest'
import { parsePeptidoform, modInfo, modsInPeptidoforms } from './peptidoform.js'

describe('parsePeptidoform', () => {
  it('reads named residue modifications', () => {
    const p = parsePeptidoform('MDIYEQM[Oxidation]EEIVINGK')
    expect(p.residues.map((r) => r.aa).join('')).toBe('MDIYEQMEEIVINGK')
    expect(p.residues[6].mods[0]).toMatchObject({ name: 'Oxidation', family: 'oxidation' })
    expect(p.residues[0].mods).toEqual([])
  })

  it('reads UNIMOD ids and terminal modifications', () => {
    const p = parsePeptidoform('[UNIMOD:737]-HELSEM[UNIMOD:35]NK[UNIMOD:737]-[Amidated]')
    expect(p.nterm[0]).toMatchObject({ name: 'TMT6plex', unimod: 'UNIMOD:737', family: 'isobaric' })
    expect(p.residues[5].mods[0].name).toBe('Oxidation')
    expect(p.residues[7].mods[0].name).toBe('TMT6plex')
    expect(p.cterm[0]).toMatchObject({ name: 'Amidated', family: 'other' })
  })

  it('keeps brackets inside a tag and several tags on one residue', () => {
    const p = parsePeptidoform('PEPK[Label:13C(6)15N(2)][Acetyl]')
    expect(p.residues[3].mods.map((m) => m.name)).toEqual(['Label:13C(6)15N(2)', 'Acetyl'])
    expect(p.residues[3].mods[0].family).toBe('silac')
  })

  it('returns null for anything that is not a peptidoform', () => {
    expect(parsePeptidoform('')).toBeNull()
    expect(parsePeptidoform(null)).toBeNull()
    expect(parsePeptidoform('PEP-TIDE')).toBeNull()
    expect(parsePeptidoform('PEP[Oxidation')).toBeNull()
  })

  it('reads OpenMS notation', () => {
    const p = parsePeptidoform('.(Acetyl)ADSRDPASDQM(Oxidation)QHWK.(Amidated)')
    expect(p.nterm[0].name).toBe('Acetyl')
    expect(p.residues[10]).toMatchObject({ aa: 'M', mods: [{ name: 'Oxidation' }] })
    expect(p.cterm[0].name).toBe('Amidated')
    expect(parsePeptidoform('VPTANVSVVDLTC(Carbamidomethyl)R').residues[12].mods[0].family).toBe('fixed')
    expect(parsePeptidoform('PEPK(Label:13C(6)15N(2))').residues[3].mods[0].name).toBe('Label:13C(6)15N(2)')
  })

  it('names unknown UNIMOD ids by their tag', () => {
    expect(modInfo('UNIMOD:999999')).toMatchObject({ name: 'UNIMOD:999999', family: 'other' })
  })
})

describe('modsInPeptidoforms', () => {
  it('counts each modification across the list, most frequent first', () => {
    const mods = modsInPeptidoforms(['[UNIMOD:737]-PEPK[UNIMOD:737]', 'M[Oxidation]K', 'PEPTIDE'])
    expect(mods.map((m) => [m.name, m.count])).toEqual([['TMT6plex', 2], ['Oxidation', 1]])
  })
})
