// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QxOverviewStats from './QxOverviewStats.vue'
import { colourScale } from '../sampleColors.js'

const STATS = {
  summary: { available: true, source: 'feature', n_target: 10, n_peptides: 6, n_peptidoforms: 8, decoy_pct: 0, median_per_run: 5 },
  per_run: { available: true, source: 'feature', rows: [['r1', 6], ['r2', 4]] },
  charge: { available: true, source: 'feature', rows: [[2, 7], [3, 3]] },
  length: { available: true, source: 'feature', rows: [[7, 4], [8, 6]] },
  missed_cleavages: { available: false, source: 'feature' },
  mass_error: { available: true, source: 'feature', bins: [[-0.04, -0.035, 3], [-0.035, -0.03, 5]], bin_width: 0.005, n_outside: 2 },
  rt: { available: false, source: 'feature' },
  intensity: { available: false, source: 'feature' },
  pep: { available: false, source: 'feature' },
  peptides_per_protein: { available: true, source: 'pg', rows: [[1, 2], [20, 1]], capped_at: 20 },
}
const SAMPLES = ['breast', 'breast', 'breast', 'lung'].map((t, i) => ({ sample_accession: `S${i}`, organism_part: t, sex: 'female', cell_line: `L${i}` }))

const ORGAN = { breast: { group: 'Reproductive and urinary systems', colour: '#6250d6' }, lung: { group: 'Respiratory system', colour: '#2a78d6' } }
const SCALES = { organism_part: colourScale(SAMPLES, 'organism_part', (v) => ORGAN[v]) }
// r1 holds a breast sample, r2 a lung sample
const COLOURING = {
  key: 'organism_part', title: 'Organism part', scale: SCALES.organism_part, highlight: '',
  value: () => null, run: (name) => ({ mixed: false, value: name === 'r1' ? 'breast' : 'lung' }),
}
// per group (s: 0 lung, 1 breast; the organ-system table puts respiratory first) and charge, as the SQL endpoint answers the split
const SPLIT = {
  columns: ['s', 'k_charge', 'g_charge', 'k_length', 'g_length', 'k_mass_error', 'g_mass_error', 'n'],
  rows: [[0, 2, 0, null, 1, null, 1, 5], [1, 2, 0, null, 1, null, 1, 2], [1, 3, 0, null, 1, null, 1, 2], [0, 7, 1, null, 1, null, 1, 9]],
  truncated: false,
}

let resolvers
let sqls
beforeEach(() => {
  resolvers = {}
  sqls = []
  global.fetch = vi.fn((url, init) => new Promise((resolve) => {
    if (String(url).endsWith('/sql')) {
      sqls.push(JSON.parse(init.body).sql)
      resolve({ ok: true, status: 200, json: async () => SPLIT })
      return
    }
    const part = String(url).split('/stats/')[1]
    resolvers[part] = () => resolve({ ok: true, status: 200, json: async () => STATS[part] })
  }))
})
afterEach(() => { vi.restoreAllMocks() })

const mountIt = (props = {}) => mount(QxOverviewStats, {
  props: { datasetRef: 'PXD1/abc', samples: SAMPLES, scales: SCALES, ...props },
  global: { stubs: { StatsChart: {
    props: ['data', 'type'],
    template: '<div class="chart" :data-type="type" :data-series="data.datasets.map((d) => d.label || \'\').join(\',\')" :data-values="data.datasets.map((d) => d.data.join(\'/\')).join(\';\')">{{ data.labels.join(",") }}</div>',
  } } },
})

describe('QxOverviewStats', () => {
  it('shows real progress as parts arrive', async () => {
    const w = mountIt()
    expect(w.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    resolvers.summary(); resolvers.charge()
    await flushPromises()
    expect(w.text()).toContain('Computing statistics · 2 of 10')
    Object.values(resolvers).forEach((r) => r())
    await flushPromises()
    expect(w.find('[role="progressbar"]').exists()).toBe(false)
  })

  it('renders tiles, charts and sample annotations', async () => {
    const w = mountIt()
    Object.values(resolvers).forEach((r) => r())
    await flushPromises()
    expect(w.text()).toContain('Peptidoforms')
    expect(w.text()).not.toContain('Decoy') // 0% decoys after FDR filtering is not shown
    const charts = w.findAll('.chart').map((c) => c.text())
    expect(charts).toContain('2+,3+')
    expect(w.text()).not.toContain('Missed cleavages') // absent parts are hidden, not shown empty
    expect(charts).toContain('-0.038,-0.033') // bin centres, decimals follow the bin width
    expect(w.text()).toContain('2 (20.0%) outside the range are not drawn.')
    expect(charts).toContain('1,20+')
    expect(charts).toContain('lung,breast') // in the organ-system table's order
    expect(w.text()).not.toContain('Sex') // a single category is not a chart
    // one value per sample names samples rather than grouping them: text, not a chart
    expect(w.find('.qo-naming').text()).toContain('Cell line: 4 distinct values')
  })

  it('splits the distributions by the sample group of each run', async () => {
    const w = mountIt({ colouring: COLOURING, runs: [{ run_file_name: 'r1' }, { run_file_name: 'r2' }] })
    Object.values(resolvers).forEach((r) => r())
    await flushPromises()
    // one query for the parts with data, on the backend's mass-error bins; none for the absent rt/intensity/pep
    expect(sqls).toHaveLength(1)
    expect(sqls[0]).toContain("VALUES ('r1', 1), ('r2', 0)")
    expect(sqls[0]).toContain('GROUPING SETS ((s, k_charge), (s, k_length), (s, k_mass_error))')
    expect(sqls[0]).toContain('floor((v_mass_error - -0.04) / 0.005)')
    const charge = w.findAll('.chart').find((c) => c.text() === '2+,3+')
    expect(charge.attributes('data-series')).toBe('lung,breast')
    // each group as a share of its own features
    expect(charge.attributes('data-values')).toBe('100/0;50/50')
    // runs are grouped by organism part; peptides per protein group stays whole-dataset
    expect(w.findAll('.chart').find((c) => c.text() === 'r2,r1').attributes('data-series')).toBe('')
    expect(w.findAll('.chart').find((c) => c.text() === '1,20+').attributes('data-type')).toBe('bar')
  })
})
