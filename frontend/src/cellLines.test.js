import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  studyProfile,
  compareParams, compare, presenceState, errorMessage, tabFromQuery, listFromQuery, boxStats,
  sortRows, getGene, getDatasets, searchLines, groupDots, kindFromQuery, byParam, rnaVerdict, rnaByDetection,
  detectedScatter, lineageColor, rule, decisionList, RULE_DEFAULTS, filterPartners, accessionUrl, enrichmentColor, signed, radialLayout, groupSummary, tukeyBox,
} from './cellLines.js'
import { ApiError } from './api.js'

const ok = (b) => ({ ok: true, status: 200, json: async () => b })
beforeEach(() => { global.fetch = vi.fn() })
afterEach(() => { vi.restoreAllMocks() })

describe('compare request building', () => {
  it('builds a lines request from 2 to 5 distinct lines', () => {
    expect(compareParams({ mode: 'lines', lines: ['CVCL_1', 'CVCL_2', 'CVCL_1'] })).toEqual({ lines: 'CVCL_1,CVCL_2' })
    expect(compareParams({ mode: 'lines', lines: ['CVCL_1', 'CVCL_2'], reproducibleOnly: true })).toEqual({ lines: 'CVCL_1,CVCL_2', reproducible_only: true })
    expect(compareParams({ mode: 'lines', lines: ['CVCL_1'] })).toBeNull()
    expect(compareParams({ mode: 'lines', lines: ['a', 'b', 'c', 'd', 'e', 'f'] })).toBeNull()
  })

  it('builds a group request only with a known group and two different values', () => {
    expect(compareParams({ mode: 'groups', group: 'lineage', a: 'Breast', b: 'Lung' })).toEqual({ group: 'lineage', a: 'Breast', b: 'Lung', background: true })
    expect(compareParams({ mode: 'groups', group: 'primary_disease', a: 'NSCLC', b: 'NSCLC' })).toBeNull()
    expect(compareParams({ mode: 'groups', group: 'tissue', a: 'x', b: 'y' })).toBeNull()
    expect(compareParams({ mode: 'groups', group: 'lineage', a: 'Breast' })).toBeNull()
  })

  it('sends the expected query string and skips incomplete selections', async () => {
    global.fetch.mockResolvedValue(ok({ lines: [], genes: [] }))
    await compare({ mode: 'lines', lines: ['CVCL_0000', 'CVCL_0023'] })
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/cell-lines\/compare\?lines=CVCL_0000%2CCVCL_0023$/)
    await compare({ mode: 'groups', group: 'lineage', a: 'Breast', b: 'Lung' })
    expect(global.fetch.mock.calls[1][0]).toMatch(/\/compare\?group=lineage&a=Breast&b=Lung&background=true$/)
    expect(await compare({ mode: 'lines', lines: ['x'] })).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('api wrappers', () => {
  it('encodes the gene path and unwraps search lists', async () => {
    global.fetch.mockResolvedValueOnce(ok({ gene: {} }))
    await getGene('HLA-A/B')
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/cell-lines\/genes\/HLA-A\/B$/)
    global.fetch.mockResolvedValueOnce(ok({ lines: [{ line: 'CVCL_0023' }] }))
    expect(await searchLines('a549')).toEqual([{ line: 'CVCL_0023' }])
    expect(global.fetch.mock.calls[1][0]).toContain('/lines?q=a549')
  })
})

describe('presence classification', () => {
  it('separates ≥2 peptides, detected, not detected and not measured', () => {
    expect(presenceState({ n_studies_measured: 2, n_studies_present: 2, n_studies_present_high: 1 })).toBe('high')
    expect(presenceState({ n_studies_measured: 2, n_studies_present: 1, n_studies_present_high: 0 })).toBe('detected')
    expect(presenceState({ n_studies_measured: 2, n_studies_present: 0, n_studies_present_high: 0 })).toBe('absent')
    expect(presenceState({ n_studies_measured: 0, n_studies_present: 0 })).toBe('unmeasured')
    expect(presenceState(undefined)).toBe('unmeasured')
  })
})

describe('messages and query parsing', () => {
  it('maps 503 to the atlas-loading message and 404 to not in the atlas', () => {
    expect(errorMessage(new ApiError('x', 503))).toBe('The atlas is loading, try again shortly.')
    expect(errorMessage(new ApiError('x', 404), 'Gene NOPE')).toBe('Gene NOPE is not in the atlas.')
    expect(errorMessage(new ApiError('x', 0))).toMatch(/unavailable/)
  })

  it('reads the tab and comma lists from the query', () => {
    expect(tabFromQuery({ tab: 'compare' })).toBe('compare')
    expect(tabFromQuery({ tab: 'bogus' })).toBe('overview')
    expect(tabFromQuery({ gene: 'VIM' })).toBe('protein')
    expect(tabFromQuery({ line: 'CVCL_0030' })).toBe('line')
    expect(tabFromQuery({})).toBe('overview')
    expect(listFromQuery('a, b,,a')).toEqual(['a', 'b'])
    expect(listFromQuery(undefined)).toEqual([])
  })
})

describe('summaries', () => {
  it('computes box stats', () => {
    expect(boxStats([0.1, 0.5, 0.9, null])).toMatchObject({ min: 0.1, median: 0.5, max: 0.9, n: 3 })
    expect(boxStats([])).toBeNull()
  })

  it('sorts with nulls last', () => {
    expect(sortRows([{ v: 1 }, { v: null }, { v: 3 }], 'v', 'desc').map((r) => r.v)).toEqual([3, 1, null])
    expect(sortRows([{ v: 'b' }, { v: 'a' }], 'v', 'asc').map((r) => r.v)).toEqual(['a', 'b'])
  })

  it('colours enrichment on a diverging scale clamped at ±0.5', () => {
    expect(enrichmentColor(0)).toBe('rgb(203, 213, 225)')
    expect(enrichmentColor(0.5)).toBe('rgb(220, 38, 38)')
    expect(enrichmentColor(0.9)).toBe('rgb(220, 38, 38)')
    expect(enrichmentColor(-0.5)).toBe('rgb(37, 99, 235)')
    expect(enrichmentColor(null)).toBe('transparent')
    expect(signed(0.354)).toBe('+0.35')
    expect(signed(-0.1)).toBe('−0.10')
  })
})

describe('group dot plot', () => {
  const m = (n, p, h = 0, plex = 0) => ({ n_studies_measured: n, n_studies_present: p, n_studies_present_high: h, n_studies_plex_identified: plex })
  const lines = [
    { line: 'L1', lineage: 'Lung', primary_disease: 'NSCLC', l4_mean: 0.9, l3_mean: 1.5, ...m(2, 2, 2) },
    { line: 'L2', lineage: 'Lung', primary_disease: 'NSCLC', l4_mean: 0.6, l3_mean: 0.5, ...m(1, 1) },
    { line: 'L3', lineage: 'Lung', primary_disease: 'SCLC', l4_mean: 0, ...m(1, 0, 0, 1) },
    { line: 'L4', lineage: 'Lung', primary_disease: 'SCLC', l4_mean: 0, ...m(1, 0) },
    { line: 'L5', lineage: 'Lung', primary_disease: 'SCLC', l4_mean: null, ...m(0, 0) },
    { line: 'S1', lineage: 'Skin', primary_disease: 'Melanoma', l4_mean: 0.8, l3_mean: 1, ...m(1, 1) },
    { line: 'S2', lineage: 'Skin', primary_disease: 'Melanoma', l4_mean: 0.7, l3_mean: 0.8, ...m(1, 1) },
    { line: 'B1', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.95, l3_mean: 2, ...m(1, 1) },
    { line: 'B2', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.85, l3_mean: 1.5, ...m(1, 1) },
    { line: 'B3', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.75, l3_mean: -0.5, ...m(1, 0) },
  ]

  const groups = [
    { kind: 'lineage', value: 'Lung', n_called: 4, n_detected: 2, enrichment: 0.12, n_studies: 3, n_lines: 5 },
    { kind: 'lineage', value: 'Breast', n_called: 3, n_detected: 2, enrichment: 0.35, n_studies: 2, n_lines: 3 },
    { kind: 'lineage', value: 'Skin', n_called: 2, n_detected: 2, enrichment: 0.4, n_studies: 1, n_lines: 2 },
    { kind: 'lineage', value: 'Bone', n_called: 0, n_detected: 0, enrichment: null, n_studies: 1, n_lines: 4 },
    { kind: 'primary_disease', value: 'IDC', n_called: 3, n_detected: 2, enrichment: -0.2, n_studies: 2, n_lines: 3 },
  ]

  it('uses the API group summary and attaches the per-line rows', () => {
    const lung = groupDots(lines, groups, 'lineage').find((r) => r.value === 'Lung')
    expect(lung).toMatchObject({ n_called: 4, n_detected: 2, frac: 0.5, enrichment: 0.12, n_lines: 5, small: false })
    expect(lung.rows.map((r) => r.state)).toEqual(['high', 'detected', 'nocall', 'absent'])
    const bone = groupDots(lines, groups, 'lineage').find((r) => r.value === 'Bone')
    expect(bone).toMatchObject({ frac: null, enrichment: null, small: true, rows: [] })
  })

  it('sorts by enrichment and hides groups under 3 lines or without enrichment', () => {
    const rows = groupDots(lines, groups, 'lineage')
    expect(rows.map((r) => r.value)).toEqual(['Breast', 'Lung', 'Skin', 'Bone'])
    expect(rows.map((r) => r.small)).toEqual([false, false, true, true])
    expect(groupDots(lines, groups, 'primary_disease').map((r) => r.value)).toEqual(['IDC'])
  })

  it('computes Tukey boxes with whiskers inside 1.5×IQR', () => {
    const b = tukeyBox([0, 0.4, 0.45, 0.5, 0.55, 0.6, 1])
    expect(b).toMatchObject({ median: 0.5, lo: 0.4, hi: 0.6 })
    expect(b.q1).toBeCloseTo(0.425)
    expect(b.q3).toBeCloseTo(0.575)
    expect(tukeyBox([0.2, 0.4, 0.6, 0.8, 1])).toMatchObject({ lo: 0.2, hi: 1 })
    expect(tukeyBox([])).toBeNull()
  })

  it('builds summary rows in dot-plot order: detection, enrichment, amounts; not-detected apart; no-call lines left out', () => {
    const boxes = groupSummary(lines, groups, 'lineage', 3)
    expect(boxes.map((g) => [g.value, g.small])).toEqual([['Breast', false], ['Lung', false], ['Skin', true], ['Bone', true]])
    expect(boxes.find((g) => g.value === 'Lung')).toMatchObject({ n_called: 4, n_detected: 2, frac: 0.5, enrichment: 0.12 })
    const lung = boxes.find((g) => g.value === 'Lung')
    expect(lung.points.map((p) => [p.line, p.value, p.detected])).toEqual([['L1', 1.5, true], ['L2', 0.5, true]])
    expect(lung.absent.map((p) => p.line)).toEqual(['L4'])
    expect(lung.nocall).toBe(1)
    expect(lung.median).toBe(1)
    expect(lung.box).toBeNull()
    expect(boxes.flatMap((g) => [...g.points, ...g.absent]).some((p) => p.line === 'L5' || p.line === 'L3')).toBe(false)
  })

  it('maps the by= URL param to a group kind and back', () => {
    expect(kindFromQuery('disease')).toBe('primary_disease')
    expect(kindFromQuery('lineage')).toBe('lineage')
    expect(kindFromQuery(undefined)).toBe('lineage')
    expect(byParam('primary_disease')).toBe('disease')
    expect(byParam('lineage')).toBe('lineage')
  })
})

describe('RNA reference', () => {
  const agree = (o) => ({ rna_detect_auc: 0.9, rna_amount_rho: 0.7, rna_detect_lines: 300, icc: 0.55, flat_rna: false, ...o })

  it('reads detection and amount separately', () => {
    expect(rnaVerdict(agree({})).text)
      .toBe('RNA predicts where the protein is detected (AUC 0.90). Where detected, the amount follows RNA (ρ 0.70).')
    expect(rnaVerdict(agree({})).key).toBe('tracks')
    expect(rnaVerdict(agree({ rna_detect_auc: 0.75, rna_amount_rho: 0.4 })).key).toBe('moderate')
    expect(rnaVerdict(agree({ rna_detect_auc: null, rna_amount_rho: 0.1, icc: 0.32 })).text)
      .toBe('Where detected, the amount barely follows RNA (ρ 0.10), but protein reliability is limited (ICC 0.32).')
    expect(rnaVerdict(agree({ rna_detect_auc: 0.6, rna_amount_rho: null })).key).toBe('limited')
    expect(rnaVerdict(agree({ rna_detect_auc: null, rna_amount_rho: null, rna_detect_lines: 7 })).text)
      .toBe('Detected in 7 lines with RNA: too few to compare with RNA.')
    expect(rnaVerdict(agree({ rna_detect_auc: null, rna_amount_rho: null, flat_rna: true })).key).toBe('flat')
    expect(rnaVerdict(null)).toBeNull()
  })

  const depmap = [
    { line: 'a', name: 'A', lineage: 'Lung', log2_tpm: 5, amount: 1.2, protein_state: 'detected' },
    { line: 'b', name: 'B', lineage: 'Breast', log2_tpm: 0, amount: -0.5, protein_state: 'detected' },
    { line: 'c', name: 'C', lineage: 'Lung', log2_tpm: 0.5, amount: null, protein_state: 'absent' },
    { line: 'd', name: 'D', lineage: 'Lung', log2_tpm: 1, amount: null, protein_state: 'plex' },
    { line: 'e', name: 'E', lineage: 'Lung', log2_tpm: 2, amount: null, protein_state: 'unmeasured' },
    { line: 'f', name: 'F', lineage: 'Lung', log2_tpm: null, amount: 0.5, protein_state: 'detected' },
  ]

  it('groups RNA by protein state', () => {
    const d = rnaByDetection(depmap)
    expect(d.groups.map((g) => [g.id, g.n])).toEqual([['detected', 2], ['absent', 1]])
    expect(d.nocall).toBe(1)
    expect(d.unmeasured).toBe(1)
    expect(d.max).toBe(5)
  })

  it('plots amount in detected lines only, counts the not-detected ones and pads the axis', () => {
    const s = detectedScatter(depmap, 'log2_tpm')
    expect(s.n).toBe(2)
    expect(s.excluded).toBe(1)
    expect(s.data.datasets[0].data.map((p) => [p.label, p.y])).toEqual([['A', 1.2], ['B', -0.5]])
    expect(s.xMin).toBe(0)
    expect(s.xMax).toBeGreaterThan(5)
    const hi = detectedScatter(depmap, 'log2_tpm', { highlight: 'Lung' })
    expect(hi.data.datasets.map((d) => [d.label, d.data.length])).toEqual([['Lung', 1], ['detected lines', 1]])
    // dots take their lineage's colour; a highlighted lineage keeps it and the rest turn grey
    expect(s.data.datasets[0].backgroundColor).toHaveLength(2)
    expect(hi.data.datasets[0].backgroundColor).toBe(lineageColor('Lung').dot)
    expect(typeof hi.data.datasets[1].backgroundColor).toBe('string')
    const hpa = detectedScatter([{ line: 'x', ntpm: 3, amount: 0.2 }, { line: 'y', ntpm: 3, amount: null }], 'ntpm',
      { transform: (v) => Math.log2(v + 1), isDetected: (r) => r.line === 'x' })
    expect(hpa.data.datasets[0].data).toEqual([{ x: 2, y: 0.2, label: 'x', lineage: 'unmapped' }])
    expect(hpa.excluded).toBe(1)
  })
})

describe('co-expression partners', () => {
  const partners = [
    { partner: 'A', z: 8, strong: true, shared_complexes: ['26S proteasome'] },
    { partner: 'B', z: 6, validated: true, shared_complexes: [] },
    { partner: 'C', z: 4, strong: false, shared_complexes: ['26S proteasome'] },
    { partner: 'D', z: -3, validated: false, shared_complexes: [] },
  ]

  it('puts every partner on one circle, ordered by Z', () => {
    const nodes = radialLayout(partners, { cx: 0, cy: 0, radius: 100 })
    expect(nodes.map((n) => n.partner)).toEqual(['A', 'B', 'C', 'D'])
    for (const n of nodes) expect(Math.hypot(n.x, n.y)).toBeCloseTo(100)
    expect(nodes[0].strength).toBe(1)
    expect(nodes[3].strength).toBeCloseTo(3 / 8)
    expect(radialLayout([{ partner: 'N', z: -5 }, { partner: 'P', z: 4 }]).map((n) => n.partner)).toEqual(['P', 'N'])
  })

  it('filters all, beyond shared complexes and strong only (reading the older validated field too)', () => {
    expect(filterPartners(partners, 'all').map((p) => p.partner)).toEqual(['A', 'B', 'C', 'D'])
    expect(filterPartners(partners, 'beyond').map((p) => p.partner)).toEqual(['B', 'D'])
    expect(filterPartners(partners, 'strong').map((p) => p.partner)).toEqual(['A', 'B'])
    expect(filterPartners(undefined, 'all')).toEqual([])
  })
})

describe('atlas studies', () => {
  it('links PXD, MSV and PMID accessions', () => {
    expect(accessionUrl('PXD030304')).toBe('https://www.ebi.ac.uk/pride/archive/projects/PXD030304')
    expect(accessionUrl('MSV000085836')).toBe('https://massive.ucsd.edu/ProteoSAFe/dataset.jsp?accession=MSV000085836')
    expect(accessionUrl('PMID23933261')).toBe('https://pubmed.ncbi.nlm.nih.gov/23933261')
    expect(accessionUrl('ProCan')).toBe('')
  })

  it('unwraps the studies list', async () => {
    global.fetch.mockResolvedValueOnce(ok({ studies: [{ study: 'S1' }] }))
    expect(await getDatasets()).toEqual([{ study: 'S1' }])
  })
})

describe('lines without a per-line presence call', () => {
  it('are "no call", not detected, and the tooltip names no acquisition', () => {
    const row = { name: 'X', n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0, n_studies_plex_identified: 1 }
    expect(presenceState(row)).toBe('nocall')
    expect(presenceState({ ...row, n_studies_measured: 2, n_studies_present: 1 })).toBe('detected')
  })
})

describe('studyProfile identity', () => {
  it('groups a line missing from the ranked list by the lineage on its value row', () => {
    const values = [{ study: 'S1', line: 'L1', l3: 0.5, present: true, lineage: 'Bowel', name: 'HT-29' }]
    const groups = studyProfile(values, [], 'S1', 'lineage')
    expect(groups.map((g) => g.value)).toEqual(['Bowel'])
  })
})

describe('manifest rules and decisions', () => {
  it('uses manifest rules', () => {
    expect(rule({ rules: { min_group_lines: 4 } }, 'min_group_lines')).toBe(4)
  })
  it('uses decisions block', () => {
    expect(rule({ decisions: { MAX_COMPARE_LINES: { value: 6 } } }, 'max_compare_lines')).toBe(6)
  })
  it('uses fallback when manifest lacks rules', () => {
    expect(rule(null, 'min_group_lines')).toBe(3)
    expect(rule({}, 'max_compare_lines')).toBe(5)
    expect(RULE_DEFAULTS).toEqual({ min_group_lines: 3, max_compare_lines: 5 })
  })
  it('decisionList builds links only with a public base', () => {
    const list = decisionList({ decisions: {
      B: { value: 1, title: 'Group views', decision: 'DR-016', version: '0.1', status: 'draft', file: 'DR-016-group-views.md' },
      A: { value: 2, decision: 'DR-016', version: null, status: null, file: null },
      C: { value: 3, decision: 'DR-002', file: 'DR-002-x.md' } } })
    expect(list.map((d) => d.constant)).toEqual(['C', 'A', 'B'])
    expect(list.every((d) => d.url === null)).toBe(true)
    const linked = decisionList({ decisions: { B: { decision: 'DR-016', file: 'DR-016-group-views.md' }, A: { decision: 'DR-016', file: null } } }, 'https://x.org/d/')
    expect(linked.find((d) => d.constant === 'B').url).toBe('https://x.org/d/DR-016-group-views.md')
    expect(linked.find((d) => d.constant === 'A').url).toBeNull()
    expect(decisionList({ decisions: { B: { decision: 'DR-016', file: 'f.md' } } }, '')[0].url).toBeNull()
    expect(list[2].title).toBe('Group views')
    expect(list[1].title).toBeNull()
    expect(decisionList({})).toEqual([])
  })
  it('compareParams honours maxLines', () => {
    expect(compareParams({ mode: 'lines', lines: ['a', 'b', 'c', 'd', 'e', 'f'], maxLines: 6 })).not.toBeNull()
  })
})
