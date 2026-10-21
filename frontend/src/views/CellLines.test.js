// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiGet: vi.fn() }
})
import { apiGet, ApiError } from '../api.js'
import CellLines from './CellLines.vue'
import { routes } from '../router.js'

const manifest = { atlas: 'v3.5', built: '2026-10-20T10:00:00+00:00', amendments: ['A41', 'A44'], level4: 'level4_rank_corrected (A41)' }
const groups = { groups: [{ group: 'lineage', value: 'Lung', n_lines: 3 }, { group: 'lineage', value: 'Breast', n_lines: 2 }] }
const vim = {
  gene: { gene: 'VIM', reliability_class: 'reliable', icc: 0.81, spec_cat3: 'lineage enriched', spec_top3: 'Lung', n_lines_present: 2, n_lines_measured: 3, n_studies: 4, is_family: false, contamination_prone: true },
  lines: [
    { line: 'CVCL_0001', name: 'L1', lineage: 'Lung', primary_disease: 'NSCLC', l4_mean: 0.9, l3_mean: 1.6, n_studies_measured: 2, n_studies_present: 2, n_studies_present_high: 2 },
    { line: 'CVCL_0002', name: 'L2', lineage: 'Lung', primary_disease: 'NSCLC', l4_mean: 0.5, l3_mean: 0, n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0 },
    { line: 'CVCL_0004', name: 'L3', lineage: 'Lung', primary_disease: 'SCLC', l4_mean: 0, n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0, n_studies_plex_identified: 1 },
    { line: 'CVCL_0003', name: 'B1', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.4, l3_mean: -0.4, n_studies_measured: 1, n_studies_present: 1, n_studies_present_high: 0 },
  ],
  values: [
    { study: 'S1', line: 'CVCL_0001', l1: 20.1, l3: 0.3, present: true, present_high: true, n_pep: 5, acq: 'DIA', comparability: 'full' },
    { study: 'S1', line: 'CVCL_0002', l1: 18.0, l3: -1.2, present: false, present_high: false, n_pep: 1, acq: 'DIA', comparability: 'full' },
    { study: 'S1', line: 'CVCL_0004', l1: null, l3: null, present: false, present_high: false, n_pep: null, acq: 'DIA', comparability: 'full' },
  ],
  studies: [{ study: 'S1', acq: ['DIA'], methods: ['directLFQ'], n_lines: 40, accessions: ['PXD000001'] }],
  groups: [
    { kind: 'lineage', value: 'Lung', n_called: 2, n_detected: 1, enrichment: 0.35, n_studies: 2, n_lines: 3 },
    { kind: 'lineage', value: 'Breast', n_called: 1, n_detected: 1, enrichment: null, n_studies: 1, n_lines: 1 },
    { kind: 'primary_disease', value: 'NSCLC', n_called: 2, n_detected: 1, enrichment: -0.12, n_studies: 2, n_lines: 2 },
  ],
  links: { uniprot: 'https://u', depmap: 'https://d', string: 'https://s', hpa_cell_line: 'https://h1', hpa_tissue: 'https://h2' },
}
const coexp = {
  gene: 'VIM',
  threshold: '|Z| >= 5 (A44)',
  display_min_z: 4.0,
  complexes: [{ complex_ac: 'CPX-1', complex_name: 'Intermediate filament' }],
  partners: [
    { partner: 'DES', z: 7.2, rank: 1, studies: 5, distinct_lines: 300, validated: true, reliability_class: 'reliable', shared_complexes: ['Intermediate filament'] },
    { partner: 'LMNA', z: 6.1, rank: 2, studies: 5, distinct_lines: 280, validated: true, reliability_class: 'reliable', shared_complexes: [] },
    { partner: 'NES', z: 4.3, rank: 3, studies: 4, distinct_lines: 200, validated: false, reliability_class: 'moderate', shared_complexes: [] },
  ],
}
const rnaBody = {
  depmap: [
    { line: 'CVCL_0001', name: 'L1', lineage: 'Lung', log2_tpm: 8, amount: 1.6, protein_state: 'detected' },
    { line: 'CVCL_0003', name: 'B1', lineage: 'Breast', log2_tpm: 6, amount: -0.4, protein_state: 'detected' },
    { line: 'CVCL_0002', name: 'L2', lineage: 'Lung', log2_tpm: 1, amount: null, protein_state: 'absent' },
    { line: 'CVCL_0004', name: 'L3', lineage: 'Lung', log2_tpm: 2, amount: null, protein_state: 'plex' },
    { line: 'CVCL_0009', name: 'X9', lineage: 'Skin', log2_tpm: 12, amount: null, protein_state: 'unmeasured' },
  ],
  hpa: [{ line: 'CVCL_0001', name: 'L1', lineage: 'Lung', ntpm: 255, amount: 1.6 }, { line: 'CVCL_0002', name: 'L2', lineage: 'Lung', ntpm: 3, amount: null }],
  agreement: { rna_detect_auc: 0.96, rna_detect_lines: 83, rna_undetected_lines: 620, rna_amount_rho: 0.77, rna_amount_lines: 73, rna_sd: 2.1, flat_rna: false, icc: 0.81, reliability_class: 'reliable', n_lines_present: 2, n_lines_measured: 4, n_lines_plex_only: 1, auc_percentile: 0.97, rho_percentile: 0.99 },
  atlas: { bin: 0.05, flat_rna_sd: 0.5, auc: { hist: [[0.7, 10], [0.95, 4]], median: 0.73, genes: 8990 }, rho: { hist: [[0.3, 10], [0.75, 4]], median: 0.39, genes: 8977 } },
  sources: {},
}

const overview = {
  tiles: { proteins: 15704, lines: 1119, lineages: 28, diseases: 93, studies: 14, reproducible: 2159, enriched: 240,
    enhanced: 1414, robust: 335, coexpression_links: 7825, coexpression_proteins: 3135, complexes: 2489 },
  lineages: [{ lineage: 'Lung', lines: 120 }, { lineage: 'Breast', lines: 60 }],
  heatmap: [
    { gene: 'SFTPB', lineage: 'Lung', spec_cat3: 'lineage enriched', enrichment: [0.6, -0.1] },
    { gene: 'TRPS1', lineage: 'Breast', spec_cat3: 'enhanced', enrichment: [-0.05, 0.49] },
  ],
  landscape: { columns: ['gene', 'detected_fraction', 'icc', 'spec_cat3', 'coexpression_partners'],
    rows: [['VIM', 0.9, 0.74, 'low specificity', 12], ['SFTPB', 0.1, null, 'lineage enriched', 0]] },
}
const tableRow = (o) => ({
  gene: 'VIM', protein_name: 'Vimentin', accession: 'P08670', n_lines_present: 971, n_lines_measured: 1119,
  n_lines_present_high: 960, n_studies: 14, detected_fraction: 0.87, reliability_class: 'reproducible', icc: 0.74,
  spec_cat3: 'low specificity', spec_top: [], spec_robust: true, spec_lab_reproducible: false, rna_detect_auc: 0.87,
  rna_amount_rho: 0.9, coexpression_partners: 12, coexpression_top: ['DES', 'LMNA'], n_complexes: 0, complex_name: null,
  contamination_prone: false, is_family: false, lineage_enrichment: null, lineage_detected: null, lineage_called: null, ...o,
})
const table = (params) => ({
  total: 2, offset: 0, lineage: params.lineage || null, sort: params.sort || (params.lineage ? 'lineage' : 'specificity'),
  descending: params.lineage ? true : false,
  facets: { spec_cat3: { 'lineage enriched': 1, 'low specificity': 1 }, reliability_class: { reproducible: 1, 'not scored': 1 } },
  rows: [
    tableRow({ gene: 'SFTPB', protein_name: 'Pulmonary surfactant-associated protein B', accession: 'P07988', spec_cat3: 'lineage enriched',
      spec_top: ['Lung'], reliability_class: 'not scored', icc: null, rna_detect_auc: null, rna_amount_rho: null, coexpression_partners: 0,
      coexpression_top: [], lineage_enrichment: params.lineage ? 0.6 : null, lineage_detected: 12, lineage_called: 40 }),
    tableRow({}),
  ],
})

const allLines = {
  lines: [
    { line: 'CVCL_0031', name: 'MCF7', depmap_id: 'ACH-000019', lineage: 'Breast', primary_disease: 'Invasive Breast Carcinoma', subtype: null, sex: 'Female',
      non_cancerous: false, problematic: null, studies: ['CCLE', 'ProCan', 'S3'], acq: ['DIA', 'TMT'], n_studies: 3, samples: 12, flagged_samples: 1, sex_flag: false, identity_verdict: null },
    { line: 'CVCL_0598', name: 'MCF-10A', depmap_id: 'ACH-001357', lineage: 'Breast', primary_disease: 'Non-Cancerous', subtype: null, sex: 'Female',
      non_cancerous: true, problematic: null, studies: ['S3'], acq: ['DIA'], n_studies: 1, samples: 6, flagged_samples: 0, sex_flag: false, identity_verdict: null },
    { line: 'CVCL_0023', name: 'A549', depmap_id: 'ACH-000681', lineage: 'Lung', primary_disease: 'Non-Small Cell Lung Cancer', subtype: null, sex: 'Male',
      non_cancerous: false, problematic: null, studies: ['CCLE', 'ProCan'], acq: ['DIA', 'TMT'], n_studies: 2, samples: 9, flagged_samples: 0, sex_flag: false, identity_verdict: null },
  ],
}

function respond(overrides = {}) {
  apiGet.mockImplementation(async (base, path, params) => {
    if (path in overrides) {
      const v = overrides[path]
      if (v instanceof Error) throw v
      return typeof v === 'function' ? v(params) : v
    }
    if (path === '/manifest') return manifest
    if (path === '/overview') return overview
    if (path === '/lines/all') return allLines
    if (path === '/table') return table(params)
    if (path === '/groups') return groups
    if (path === '/genes/VIM') return vim
    if (path === '/genes/VIM/rna') return rnaBody
    if (path === '/genes/VIM/coexpression' || path === '/genes/DES/coexpression') return coexp
    if (path === '/datasets') return { studies: [] }
    if (path === '/compare') return params.lines ? { lines: [], genes: [] } : { group: params.group, a: params.a, b: params.b, genes: [], background: [] }
    throw new ApiError('not found', 404)
  })
}

async function mountAt(path) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  const w = mount(CellLines, { global: { plugins: [router], stubs: { ScatterChart: true } } })
  await flushPromises()
  return { w, router }
}

describe('CellLines view', () => {
  beforeEach(() => { apiGet.mockReset() })

  it('opens on the overview: tiles, lineage map, landscape and a colour-coded protein table', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines')
    expect(w.find('[data-tab="overview"]').attributes('aria-selected')).toBe('true')
    const tiles = w.findAll('[data-test="tiles"] .cl-tile')
    expect(tiles).toHaveLength(7)
    expect(tiles[0].text()).toContain('15,704')
    expect(tiles[4].text()).toContain('240lineage / group enriched1,414 more enhanced · 335 robust calls')
    expect(w.findAll('[data-test="heatmap"] .cl-heat-body').map((r) => r.attributes('data-gene'))).toEqual(['SFTPB', 'TRPS1'])
    const rows = w.findAll('[data-test="protein-row"]')
    expect(rows.map((r) => r.find('.cl-pt-gene').text())).toEqual(['SFTPB', 'VIM'])
    expect(rows[1].text()).toContain('971 / 1,119 lines')
    expect(rows[1].find('.cl-strength-strong').text()).toBe('detect 0.87')
    expect(rows[0].text()).toContain('too few detections')
    expect(w.findAll('[data-test="spec-chip"]')[0].text()).toBe('lineage enriched 1')
    expect(w.find('[data-test="table-csv"]').attributes('href')).toMatch(/\/table\?format=csv$/)

    await w.findAll('[data-test="heatmap"] .cl-heat-body')[0].trigger('click')
    await flushPromises()
    const last = apiGet.mock.calls.filter((c) => c[1] === '/table').at(-1)[2]
    expect([last.q, last.lineage]).toEqual(['SFTPB', 'Lung'])
    expect(w.find('[data-test="protein-table"]').text()).toContain('In Lung')
    expect(w.find('[data-test="protein-table"]').text()).toContain('detected in 12 of 40 lines')

    await tiles[3].trigger('click')
    await flushPromises()
    expect(apiGet.mock.calls.filter((c) => c[1] === '/table').at(-1)[2].rels).toBe('reproducible')

    await rows[1].find('.cl-pt-gene').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'protein', gene: 'VIM' })
  })

  it('lists every cell line on the Cell line tab, with filters, and opens one', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines?tab=line')
    const rows = () => w.findAll('[data-test="line-row"]')
    expect(rows().map((r) => r.find('.cl-pt-gene').text())).toEqual(['MCF7', 'A549', 'MCF-10A'])  // most studies first
    expect(rows()[0].text()).toContain('1 QC-flagged')
    expect(rows()[2].text()).toContain('non-cancerous')
    await w.find('[data-test="lines-lineage"]').setValue('Lung')
    expect(rows().map((r) => r.find('.cl-pt-gene').text())).toEqual(['A549'])
    expect(w.find('[data-test="lines-count"]').text()).toBe('1 of 3 cell lines')
    await rows()[0].find('.cl-pt-gene').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'line', line: 'CVCL_0023' })
  })

  it('picks cell lines to compare by ticking them in the list', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines?tab=compare')
    expect(w.find('[data-test="compare-browse"]').attributes('open')).toBeDefined()
    const box = (name) => w.findAll('[data-test="line-row"]').find((r) => r.text().includes(name)).find('input[type="checkbox"]')
    await box('MCF7').setValue(true)
    await flushPromises()
    expect(router.currentRoute.value.query.lines).toBe('CVCL_0031')
    await box('A549').setValue(true)
    await flushPromises()
    expect(String(router.currentRoute.value.query.lines)).toBe('CVCL_0031,CVCL_0023')
  })

  it('profiles the gene within one study, disables studies without values, and groups the values table by study', async () => {
    respond({ '/genes/VIM': { ...vim, studies: [{ study: 'S2', acq: ['TMT'], methods: ['piBAQ + IRS'], n_lines: 400, accessions: [] }, ...vim.studies] } })
    const { w } = await mountAt('/apps/cell-lines?tab=protein&gene=VIM')
    const select = w.find('[data-test="profile-study"]')
    expect(select.element.value).toBe('S1')
    const options = select.findAll('option')
    expect(options.map((o) => [o.text(), o.element.disabled])).toEqual([
      ['S1 · DIA · directLFQ · 2 of 40 lines quantified', false],
      ['S2 · TMT · piBAQ + IRS · 0 of 400 lines quantified (not quantified)', true],
    ])
    expect(w.find('[data-test="profile-caption"]').text()).toContain("log2 difference from S1's average for VIM")
    const lung = w.find('[data-test="profile-plot"]').findAll('[data-test="profile-group"]')[0]
    expect(lung.find('.cl-gs-name').text()).toBe('Lung')
    expect(lung.findAll('.cl-strip-dot').map((c) => c.attributes('data-line'))).toEqual(['CVCL_0001', 'CVCL_0002'])
    expect(lung.find('.cl-strip-nd').text()).toBe('1 n.d.')
    expect(lung.find('.cl-strip-dot').attributes('title')).toBe('L1 · +0.30 log2 · 1.2× the study average')
    const table = w.find('[data-test="values-table"]')
    expect(w.find('[data-test="values-details"]').attributes('open')).toBeUndefined()
    expect(table.find('[data-test="study-row"]').text()).toContain('S1 · DIA · directLFQ · 40 lines')
    expect(table.text()).toContain('Difference from study average (log2)')
    expect(table.text()).not.toContain('l3')
  })

  it('warns on the cross-study plot only when the protein does not reproduce between labs', async () => {
    respond({ '/genes/VIM': { ...vim, gene: { ...vim.gene, reliability_class: 'partial', icc: 0.39 } } })
    let { w } = await mountAt('/apps/cell-lines?gene=VIM')
    expect(w.find('[data-test="box-reliability"]').text()).toContain('reproduce only weakly between labs (ICC 0.39)')
    respond({ '/genes/VIM': { ...vim, gene: { ...vim.gene, reliability_class: 'reproducible' } } })
    ;({ w } = await mountAt('/apps/cell-lines?gene=VIM'))
    expect(w.find('[data-test="box-reliability"]').exists()).toBe(false)
  })

  it('reads tab and gene from the URL and writes tab changes back', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines?tab=protein&gene=VIM')
    expect(apiGet.mock.calls.some((c) => c[1] === '/genes/VIM')).toBe(true)
    expect(w.find('[data-tab="protein"]').attributes('aria-selected')).toBe('true')
    const header = w.find('[data-test="gene-header"]').text()
    expect(header).toContain('VIM')
    expect(header).toContain('reliable')
    expect(header).toContain('contamination-prone')
    expect(w.text()).toContain('Each study has its own scale')
    expect(w.text()).toContain('|Z| >= 5 (A44)')
    expect(w.find('[data-test="provenance"]').text()).toContain('Updated 2026-10-20')

    await w.find('[data-tab="line"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'line', gene: 'VIM' })
    expect(w.find('[data-tab="line"]').attributes('aria-selected')).toBe('true')
  })

  it('switches to a partner gene from the neighbours table', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines?gene=VIM')
    const partner = w.findAll('button').find((b) => b.text() === 'DES')
    await partner.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'protein', gene: 'DES' })
  })

  it('keeps acquisition wording out of the biology views of the protein tab', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    const perStudy = (c) => c.find('[data-test="values-table"]').exists() || c.find('[data-test="profile-study"]').exists()
    const biology = w.findAll('section.cl-card').filter((c) => !perStudy(c))
    for (const c of biology) expect(c.text()).not.toMatch(/\bTMT\b|\bDIA\b|\bDDA\b|plex\b/)
    expect(w.find('[data-test="group-summary"]').exists()).toBe(true)
  })

  it('summarises each lineage in one row: detection, enrichment and an amount strip', async () => {
    const mk = (i, l3, present, plex = 0, lineage = 'Lung') => ({ line: `CVCL_10${i}`, name: `N${i}`, lineage, primary_disease: 'NSCLC', l4_mean: 0.5, l3_mean: l3, n_studies_measured: 1, n_studies_present: present, n_studies_present_high: 0, n_studies_plex_identified: plex })
    const lines = [...vim.lines, mk(1, 1.2, 1), mk(2, 0.4, 1), mk(3, -1, 0), mk(4, 0.3, 0, 1), mk(5, null, 1), mk(9, null, 0),
      mk(6, 2.5, 1, 0, 'Skin'), mk(7, 2, 1, 0, 'Skin'), mk(8, 1, 0, 0, 'Skin')]
    const groupsApi = [
      { kind: 'lineage', value: 'Skin', n_called: 3, n_detected: 2, enrichment: 0.4, n_studies: 2, n_lines: 3 },
      { kind: 'lineage', value: 'Lung', n_called: 6, n_detected: 3, enrichment: 0.1, n_studies: 2, n_lines: 8 },
      { kind: 'lineage', value: 'Breast', n_called: 1, n_detected: 1, enrichment: null, n_studies: 1, n_lines: 1 },
    ]
    respond({ '/genes/VIM': { ...vim, lines, groups: groupsApi } })
    const { w, router } = await mountAt('/apps/cell-lines?gene=VIM')
    const rows = () => w.findAll('[data-test="gs-row"]')
    expect(rows().map((r) => r.find('.cl-gs-name').text())).toEqual(['Skin 3', 'Lung 8'])
    const lung = rows()[1]
    expect(lung.find('[data-test="gs-det"]').text()).toBe('3 of 6')
    expect(lung.find('.cl-gs-enr-val').text()).toBe('+0.10')
    const dots = lung.findAll('.cl-strip-dot')
    expect(dots.map((c) => c.attributes('data-line'))).toEqual(['CVCL_0001', 'CVCL_0002', 'CVCL_101', 'CVCL_102', 'CVCL_103'])
    expect(dots.map((c) => c.classes().includes('on'))).toEqual([true, false, true, true, false])
    expect(lung.find('.cl-strip-nd').text()).toBe('1 n.d.')
    expect(lung.find('.cl-strip-iqr').exists()).toBe(true)
    expect(dots[0].attributes('title')).toBe('L1 · +1.60 log2 · 3.0× the average')

    await w.find('[data-test="hi-line"]').setValue('n2')
    expect(w.findAll('.cl-strip-dot.ring').map((c) => c.attributes('data-line'))).toEqual(['CVCL_102'])
    expect(rows()[0].classes()).toContain('dim')
    await w.find('[data-test="hi-line"]').setValue('')

    const card = w.findAll('section.cl-card').find((c) => c.find('[data-test="group-summary"]').exists())
    expect(card.find('[data-test="box-caption"]').text()).toContain('2 cell lines measured only in pooled samples are not shown.')
    expect(card.text()).not.toMatch(/\bTMT\b|\bDIA\b|\bDDA\b|plex\b/)

    await w.find('[data-test="gs-toggle"]').trigger('click')
    expect(rows().map((r) => r.find('.cl-gs-name').text())).toEqual(['Skin 3', 'Lung 8', 'Breast 1'])

    await rows()[1].findAll('.cl-strip-dot')[2].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'line', line: 'CVCL_101' })
  })

  it('says so when no cell line has a per-line amount', async () => {
    const lines = vim.lines.map((l) => ({ ...l, l3_mean: null, n_studies_present: 0, n_studies_present_high: 0, n_studies_plex_identified: 1 }))
    respond({ '/genes/VIM': { ...vim, lines, values: [] } })
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    expect(w.find('[data-test="gs-empty"]').text()).toContain('No cell line has a per-line amount for VIM')
    expect(w.find('[data-test="profile-empty"]').text()).toContain('VIM has no quantified value in any study.')
  })

  it('reads and writes the grouping as by= in the URL', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines?gene=VIM&by=disease')
    expect(w.find('[aria-label="Group by"] button.active').text()).toBe('Primary disease')
    expect(w.text()).toContain('VIM by primary disease: detection, enrichment and amount')
    await w.findAll('[aria-label="Group by"] button').find((b) => b.text() === 'Lineage').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ gene: 'VIM', by: 'lineage' })
    await w.findAll('[aria-label="Group by"] button').find((b) => b.text() === 'Primary disease').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.by).toBe('disease')
  })

  it('shows the RNA verdict, detection groups and a detected-only scatter', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    expect(w.find('[data-test="rna-verdict"]').text())
      .toBe('RNA predicts where the protein is detected (AUC 0.96). Where detected, the amount follows RNA (ρ 0.77).')
    expect(w.findAll('[data-test="rna-detection-row"]').map((r) => r.find('.cl-presence-label').text()))
      .toEqual(['Detected n=2', 'Not detected n=1'])
    const chart = w.findComponent({ name: 'ScatterChart' })
    expect(chart.props('data').datasets[0].data.map((p) => [p.label, p.y])).toEqual([['L1', 1.6], ['B1', -0.4]])
    expect(w.find('[data-test="rna-scatter-note"]').text()).toContain('1 line where the protein was not detected is left out')
    expect(w.find('[data-test="rna-hist-auc"]').text()).toContain('VIM 0.96 over 703 lines, 97% percentile')
    expect(w.find('[data-test="rna-hist-rho"]').text()).toContain('VIM 0.77 over 73 lines, 99% percentile · atlas median 0.39 over 8977 genes')
    expect(w.text()).toContain('whether the protein was detected. 1 line without a presence call is not shown. 1 line with RNA')
    expect(w.text()).toContain('0.5 = chance')

    await w.findAll('button').find((b) => b.text() === 'HPA cell lines').trigger('click')
    expect(w.findComponent({ name: 'ScatterChart' }).props('data').datasets[0].data.map((p) => p.label)).toEqual(['L1'])
  })

  it('skips the scatter when RNA is flat', async () => {
    respond({ '/genes/VIM/rna': { ...rnaBody, agreement: { ...rnaBody.agreement, flat_rna: true, rna_detect_auc: null, rna_amount_rho: null } } })
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    expect(w.find('[data-test="rna-verdict"]').text()).toContain('RNA barely varies across lines')
    expect(w.find('[data-test="rna-flat"]').exists()).toBe(true)
    expect(w.findComponent({ name: 'ScatterChart' }).exists()).toBe(false)
  })

  it('shows the atlas-loading message on 503', async () => {
    respond({ '/genes/VIM': new ApiError('x', 503), '/manifest': new ApiError('x', 503) })
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    expect(w.text()).toContain('The atlas is loading, try again shortly.')
  })

  it('shows a not-in-atlas message on 404', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?gene=NOPE')
    expect(w.text()).toContain('Gene NOPE is not in the atlas.')
  })

  it('shows line distinctiveness within the same studies, without acquisition', async () => {
    respond({
      '/lines/CVCL_0001': {
        line: { line: 'CVCL_0001', name: 'L1', lineage: 'Lung' },
        studies: [{ study: 'S1', acq: ['TMT'], n_lines: 40, accessions: ['PXD000001'] }],
        higher_than_lineage: [{ gene: 'VIM', delta: 0.42, n_studies_compared: 2, lineage_lines: 11, n_studies: 3 }],
        lower_than_lineage: [{ gene: 'EPCAM', delta: -0.3, n_studies_compared: 1, lineage_lines: 9, n_studies: 2 }],
        lineage_enriched_present: [],
      },
    })
    const { w } = await mountAt('/apps/cell-lines?tab=line&line=CVCL_0001')
    const tables = w.findAll('.cl-grid-2 table')
    expect(tables[0].findAll('th').map((h) => h.text())).toEqual(['Gene', 'Δ vs lineage', 'Studies compared', 'Lineage peers'])
    expect(tables[0].find('tbody tr').findAll('td').map((td) => td.text())).toEqual(['VIM', '+0.42', '2', '11'])
    expect(tables[1].find('tbody tr').findAll('td').map((td) => td.text())).toEqual(['EPCAM', '−0.30', '1', '9'])
    expect(w.find('[data-test="line-distinct-caption"]').text()).toBe('Compared with the rest of its lineage in the same studies (A49).')
    const browse = w.find('[data-test="line-browse"]').text()
    expect(w.text().replace(browse, '')).not.toMatch(/TMT|Acquisition/)
  })

  it('requests a line comparison from the URL selection', async () => {
    respond()
    await mountAt('/apps/cell-lines?tab=compare&lines=CVCL_0001,CVCL_0002')
    const call = apiGet.mock.calls.find((c) => c[1] === '/compare')
    expect(call[2]).toEqual({ lines: 'CVCL_0001,CVCL_0002', reproducible_only: true })
  })

  it('compares lines on amounts, marks detection, and can include all proteins', async () => {
    const result = {
      lines: [{ line: 'CVCL_0001', name: 'L1' }, { line: 'CVCL_0002', name: 'L2' }],
      genes: [{ gene: 'ANXA1', amount: { CVCL_0001: -3.4, CVCL_0002: 2.1 }, detected: { CVCL_0001: true, CVCL_0002: false },
        spread: 5.5, reliability_class: 'reproducible' }],
      reproducible_only: true,
    }
    respond({ '/compare': () => result })
    const { w } = await mountAt('/apps/cell-lines?tab=compare&lines=CVCL_0001,CVCL_0002')
    const cells = w.findAll('[data-test="compare-cell"]')
    expect(cells.map((c) => c.text())).toEqual(['−3.40', '+2.10'])
    expect(cells.map((c) => c.find('.cl-cmp-det').classes().includes('on'))).toEqual([true, false])
    expect(cells[0].attributes('title')).toBe('ANXA1 in L1: −3.40 log2, detected')
    expect(w.find('[data-test="compare-lines-table"]').text()).toContain('reproducible')
    await w.find('[data-test="compare-reproducible"]').setValue(false)
    await flushPromises()
    expect(apiGet.mock.calls.filter((c) => c[1] === '/compare').at(-1)[2]).toEqual({ lines: 'CVCL_0001,CVCL_0002' })
  })

  it('requests a group comparison and labels it descriptive', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?tab=compare&mode=groups&group=lineage&a=Lung&b=Breast')
    const call = apiGet.mock.calls.find((c) => c[1] === '/compare')
    expect(call[2]).toEqual({ group: 'lineage', a: 'Lung', b: 'Breast', background: true })
    expect(w.find('[data-test="compare-caption"]').text()).toBe('Differences are computed within each study, between lines measured together, then combined across studies (A49); descriptive, not a statistical test.')
  })

  it('plots background genes under the top genes with an x = y line', async () => {
    respond({
      '/compare': (p) => ({
        group: p.group, a: p.a, b: p.b, background: [['AAA', 0.1, 0.2], ['BBB', 0.5, 0.5], ['VIM', 0.9, 0.3]],
        genes: [{ gene: 'VIM', delta: 0.6, mean_a: 0.9, mean_b: 0.3, n_studies_compared: 3, n_lines_a: 30, n_lines_b: 40, frac_detected_a: 0.5, frac_detected_b: null, reliability_class: 'reliable' }],
      }),
    })
    const { w } = await mountAt('/apps/cell-lines?tab=compare&mode=groups&group=lineage&a=Lung&b=Breast')
    const sets = w.findComponent({ name: 'ScatterChart' }).props('data').datasets
    expect(sets.map((d) => [d.label, d.data.length])).toEqual([['largest differences', 1], ['x = y', 2], ['all genes', 3]])
    expect(sets[1].showLine).toBe(true)
    expect(w.text()).not.toMatch(/TMT|DIA|DDA|acquisition/)
    const table = w.find('[data-test="compare-groups-table"]')
    expect(table.findAll('th').map((h) => h.text())).toEqual(['Gene', 'Δ', 'Mean A', 'Mean B', 'Studies', 'Lines A/B', 'Detected A/B', 'Reliability'])
    expect(table.find('tbody tr').findAll('td').map((td) => td.text())).toEqual(['VIM', '0.60', '0.90', '0.30', '3', '30 / 40', '50% / —', 'reliable'])
  })

  it('writes the compare group selection to the URL', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines?tab=compare&mode=groups')
    await w.find('select[aria-label="Group A"]').setValue('Lung')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'compare', mode: 'groups', a: 'Lung' })
  })

  it('renders the co-expression tab with validated and ranked edges', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?tab=coexpression&gene=VIM')
    expect(w.find('svg.cl-network').exists()).toBe(true)
    expect(w.text()).toContain('|Z| >= 5 (A44)')
    expect(w.find('[data-test="own-complexes"]').text()).toBe('Complexes: Intermediate filament')
    expect(w.findAll('[data-edge]').map((e) => e.attributes('data-edge'))).toEqual(['validated', 'validated', 'ranked'])
    expect(w.findAll('svg.cl-network line.cl-edge-ranked')).toHaveLength(1)
    expect(w.findAll('[data-test="edge-kind"]').map((c) => c.text())).toEqual(['validated (A44)', 'validated (A44)', 'ranked neighbour'])
    const badge = w.find('[data-test="same-complex"]')
    expect(badge.text()).toBe('same complex')
    expect(badge.attributes('title')).toBe('Intermediate filament')
    expect(w.find('[data-test="coexp-caption"]').text()).toContain('Partners ranked by |Z| on the A44 recipe, shown down to |Z| ≥ 4 (about one chance partner per gene expected at that level). Only |Z| ≥ 5 is validated; |Z| 4–5 are ranked neighbours. Complex Portal is used for annotation only.')
  })

  it('filters partners beyond shared complexes or validated only', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?tab=coexpression&gene=VIM')
    const partnersShown = () => w.findAll('[data-test="partner-row"]').map((r) => r.find('button').text())
    await w.find('[data-filter="beyond"]').trigger('click')
    expect(partnersShown()).toEqual(['LMNA', 'NES'])
    await w.find('[data-filter="validated"]').trigger('click')
    expect(partnersShown()).toEqual(['DES', 'LMNA'])
    expect(w.findAll('[data-edge]')).toHaveLength(2)
    await w.find('[data-filter="all"]').trigger('click')
    expect(partnersShown()).toEqual(['DES', 'LMNA', 'NES'])
  })

  it('handles a gene with no partners', async () => {
    respond({ '/genes/VIM/coexpression': { gene: 'VIM', threshold: '|Z| >= 5 (A44)', display_min_z: 4.0, partners: [], complexes: [] } })
    const { w } = await mountAt('/apps/cell-lines?tab=coexpression&gene=VIM')
    const empty = w.find('[data-test="coexp-empty"]')
    expect(empty.text()).toContain('No partners at |Z| ≥ 4 for VIM: its co-variation across lines is not distinguishable from chance.')
    expect(empty.find('a').attributes('href')).toContain('string-db.org')
    expect(empty.find('button').text()).toBe('Protein view for VIM →')
  })

  it('shows negative partners in their own colour (PSMB9)', async () => {
    const imm = ['20S immunoproteasome complex']
    const p = (partner, z, validated, shared = []) => ({ partner, z, validated, studies: 5, distinct_lines: 900, shared_complexes: shared })
    respond({
      '/genes/PSMB9/coexpression': {
        gene: 'PSMB9', threshold: '|Z| >= 5 (A44)', display_min_z: 4.0, complexes: [{ complex_ac: 'CPX-9003', complex_name: imm[0] }],
        partners: [p('PSMB8', 6.9, true, imm), p('PSMB10', 6.8, true, imm), p('TAP2', 6.2, true), p('TAP1', 6.1, true), p('TAPBP', 5.9, true),
          p('IFI35', 5.4, true), p('UBE2L6', 5.3, true), p('NMI', 5.0, true), p('B2M', 5.0, false), p('HLA-B', 4.9, false),
          p('PSME1', 4.8, false), p('PSMB5', -4.7, false)],
      },
    })
    const { w } = await mountAt('/apps/cell-lines?tab=coexpression&gene=PSMB9')
    expect(w.findAll('svg.cl-network line.cl-edge-neg')).toHaveLength(1)
    const psmb5 = w.findAll('[data-test="partner-row"]').find((r) => r.find('button').text() === 'PSMB5')
    expect(psmb5.find('td.cl-neg').text()).toBe('-4.7')
    expect(w.findAll('[data-test="same-complex"]')).toHaveLength(2)
    await w.find('[data-filter="beyond"]').trigger('click')
    expect(w.findAll('[data-test="partner-row"]')).toHaveLength(10)
    await w.find('[data-filter="validated"]').trigger('click')
    expect(w.findAll('[data-test="partner-row"]')).toHaveLength(8)
  })

  it('lists the atlas studies with linked accessions', async () => {
    respond({
      '/datasets': {
        studies: [
          { study: 'NCI60', acq: ['DDA'], n_lines: 60, n_batches: 1, accessions: ['PMID23933261'] },
          { study: 'ProCan', acq: ['DIA'], n_lines: 949, n_batches: 6, accessions: ['PXD030304'] },
          { study: 'CCLE', acq: ['TMT'], n_lines: 375, n_batches: 42, accessions: ['MSV000085836', 'PXD000000'] },
        ],
      },
    })
    const { w } = await mountAt('/apps/cell-lines?tab=datasets')
    expect(w.find('[data-test="studies-heading"]').text()).toBe('Studies in this atlas (3)')
    const rows = w.findAll('[data-test="datasets-table"] tbody tr')
    expect(rows.map((r) => r.find('td').text())).toEqual(['ProCan', 'CCLE', 'NCI60'])
    expect(rows[1].findAll('td').map((td) => td.text())).toEqual(['CCLE', 'MSV000085836, PXD000000', 'TMT', '375', '42'])
    const hrefs = w.findAll('[data-test="datasets-table"] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      'https://www.ebi.ac.uk/pride/archive/projects/PXD030304',
      'https://massive.ucsd.edu/ProteoSAFe/dataset.jsp?accession=MSV000085836',
      'https://www.ebi.ac.uk/pride/archive/projects/PXD000000',
      'https://pubmed.ncbi.nlm.nih.gov/23933261',
    ])
    await w.findAll('[data-test="datasets-table"] th')[0].trigger('click')
    expect(w.findAll('[data-test="datasets-table"] tbody tr')[0].find('td').text()).toBe('CCLE')
  })
})

describe('/apps/coexpression redirect', () => {
  it('redirects to the co-expression tab and keeps the gene', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/apps/coexpression?gene=PSMA1')
    expect(router.currentRoute.value.path).toBe('/apps/cell-lines')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression', gene: 'PSMA1' })
    await router.push('/apps/coexpression?protein=P25786')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression' })
    await router.push('/apps/coexpression')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression' })
  })
})

describe('/cell-lines redirect', () => {
  it('moves old links under /apps and keeps the query', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/cell-lines?tab=line&line=CVCL_0031')
    expect(router.currentRoute.value.path).toBe('/apps/cell-lines')
    expect(router.currentRoute.value.query).toEqual({ tab: 'line', line: 'CVCL_0031' })
  })
})
