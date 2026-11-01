// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { analyserGroup, diseaseGroup, taxonGroup, organSystem, groupLegend, TAXON_GROUPS, SEVERAL_ORGANISMS } from './chartGroups.js'

afterEach(() => { vi.restoreAllMocks() })

const reply = (body) => ({ ok: true, status: 200, json: async () => body })

describe('analyserGroup', () => {
  it('groups instrument models by mass analyser', () => {
    const g = (n) => analyserGroup(n).group
    expect(g('Q Exactive HF-X')).toBe('Orbitrap')
    expect(g('LTQ Orbitrap Velos')).toBe('Orbitrap')
    expect(g('Orbitrap Astral')).toBe('Orbitrap and Astral')
    expect(g('LTQ FT Ultra')).toBe('FT-ICR')
    expect(g('LTQ Velos')).toBe('Ion trap')
    expect(g('timsTOF Pro')).toBe('Time-of-flight')
    expect(g('TripleTOF 6600')).toBe('Time-of-flight')
    expect(g('mystery box')).toBe('Other or unknown')
  })
})

describe('taxonGroup', () => {
  it('takes the narrowest group in the UniProt lineage', async () => {
    global.fetch = vi.fn(async () => reply({ results: [{ scientificName: 'Danio rerio',
      lineage: [{ scientificName: 'Eukaryota' }, { scientificName: 'Metazoa' }, { scientificName: 'Vertebrata' }] }] }))
    const t = await taxonGroup('Danio rerio')
    expect(t.group).toBe('Other vertebrates')
    expect(t.colour).toBe(TAXON_GROUPS[1].colour)
  })

  it('does not look up an entry that lists several organisms', async () => {
    global.fetch = vi.fn()
    expect((await taxonGroup('Bacillus subtilis; Phage M13')).group).toBe(SEVERAL_ORGANISMS)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('organSystem', () => {
  it('prefers the term whose label is the name and reads the system from its ancestors', async () => {
    const O = 'http://purl.obolibrary.org/obo/'
    global.fetch = vi.fn(async () => reply({ elements: [
      { curie: 'UBERON:6110636', label: ['insect adult cerebral ganglion'], hierarchicalAncestor: [] },
      { curie: 'UBERON:0000955', label: ['brain'], hierarchicalAncestor: [`${O}UBERON_0000062`, `${O}UBERON_0001016`] },
    ] }))
    const s = await organSystem('Brain')
    expect(s.group).toBe('Nervous system')
    expect(s.match).toBe('UBERON:0000955 brain')
  })

  it('keeps a found group in the browser, so the next page load needs no lookup', async () => {
    global.fetch = vi.fn(async () => reply({ elements: [{ curie: 'UBERON:0002048', label: ['lung'], hierarchicalAncestor: ['http://purl.obolibrary.org/obo/UBERON_0001004'] }] }))
    await organSystem('Lung')
    vi.resetModules()
    const fresh = await import('./chartGroups.js')
    global.fetch = vi.fn(async () => { throw new TypeError('offline') })
    const s = await fresh.organSystem('Lung')
    expect(s.group).toBe('Respiratory system')
    // the colour comes from the current table, not from what was stored
    expect(s.colour).toBe(fresh.ORGAN_SYSTEMS.find((x) => x.label === 'Respiratory system').colour)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('puts a cell culture, found only in BTO, with the cells', async () => {
    global.fetch = vi.fn(async (url) => reply({ elements: String(url).includes('/uberon/')
      ? [] : [{ curie: 'BTO:0000214', label: 'cell culture' }] }))
    expect((await organSystem('Cell culture')).group).toBe('Cells and cell culture')
  })
})

describe('diseaseGroup', () => {
  it('separates healthy controls and cancers from other diseases by name', () => {
    const g = (n) => diseaseGroup(n).group
    expect(g('normal')).toBe('Healthy or normal')
    expect(g('Healthy')).toBe('Healthy or normal')
    expect(g('childhood b acute lymphoblastic leukemia')).toBe('Cancer')
    expect(g('breast adenocarcinoma')).toBe('Cancer')
    expect(g('covid-19')).toBe('Other disease')
  })
})

describe('groupLegend', () => {
  it('lists the groups present in their fixed order, grey ones last', () => {
    const legend = groupLegend(TAXON_GROUPS, [{ group: 'Viruses' }, { group: SEVERAL_ORGANISMS }, { group: 'Mammals' }])
    expect(legend.map((l) => l.label)).toEqual(['Mammals', 'Viruses', SEVERAL_ORGANISMS])
  })
})
