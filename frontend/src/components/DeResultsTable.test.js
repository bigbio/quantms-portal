// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeResultsTable, { sortRows, filterRows } from './DeResultsTable.vue'

describe('table ops', () => {
  const rows = [
    { protein: 'B', gene: 'BGene', adj_pvalue: 0.2 },
    { protein: 'A', gene: 'AGene', adj_pvalue: 0.01 },
  ]

  it('sorts ascending by key', () => {
    expect(sortRows(rows, 'adj_pvalue', 'asc')[0].protein).toBe('A')
  })

  it('sorts descending by key', () => {
    expect(sortRows(rows, 'adj_pvalue', 'desc')[0].protein).toBe('B')
  })

  it('does not mutate the input array', () => {
    const copy = rows.map((r) => ({ ...r }))
    sortRows(rows, 'adj_pvalue', 'asc')
    expect(rows).toEqual(copy)
  })

  it('sorts nulls last regardless of direction', () => {
    const withNull = [{ protein: 'X', adj_pvalue: null }, { protein: 'Y', adj_pvalue: 0.1 }]
    expect(sortRows(withNull, 'adj_pvalue', 'asc').map((r) => r.protein)).toEqual(['Y', 'X'])
    expect(sortRows(withNull, 'adj_pvalue', 'desc').map((r) => r.protein)).toEqual(['Y', 'X'])
  })

  it('filters by protein substring', () => {
    expect(filterRows(rows, 'a').length).toBe(1)
  })

  it('filters by gene substring case-insensitively', () => {
    expect(filterRows(rows, 'bgene').map((r) => r.protein)).toEqual(['B'])
  })

  it('returns all rows for an empty query', () => {
    expect(filterRows(rows, '')).toHaveLength(2)
  })
})

describe('DeResultsTable component', () => {
  const rows = [
    { protein: 'P1', gene: 'G1', log2fc: 1.2, pvalue: 0.02, adj_pvalue: 0.05, n_peptides: 3, mean_group_a: 5, mean_group_b: 6, significant: true },
    { protein: 'P2', gene: 'G2', log2fc: -0.5, pvalue: 0.4, adj_pvalue: 0.6, n_peptides: 2, mean_group_a: 4, mean_group_b: 3, significant: false },
  ]

  it('renders one row per input row', () => {
    const w = mount(DeResultsTable, { props: { rows, selected: null } })
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })

  it('emits select with the protein on row click', async () => {
    const w = mount(DeResultsTable, { props: { rows, selected: null } })
    await w.findAll('tbody tr')[0].trigger('click')
    expect(w.emitted('select')).toEqual([['P1']])
  })

  it('highlights the row matching selected', () => {
    const w = mount(DeResultsTable, { props: { rows, selected: 'P2' } })
    const trs = w.findAll('tbody tr')
    expect(trs[1].classes().join(' ')).toMatch(/selected/)
    expect(trs[0].classes().join(' ')).not.toMatch(/selected/)
  })

  it('links the protein to UniProt', () => {
    const w = mount(DeResultsTable, { props: { rows, selected: null } })
    const link = w.find('a[href*="uniprot.org"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toContain('P1')
  })

  it('filters rows via the filter input', async () => {
    const w = mount(DeResultsTable, { props: { rows, selected: null } })
    await w.find('input').setValue('G2')
    expect(w.findAll('tbody tr')).toHaveLength(1)
    expect(w.find('tbody tr').text()).toContain('P2')
  })

  it('toggles sort direction when clicking the same header twice', async () => {
    const w = mount(DeResultsTable, { props: { rows, selected: null } })
    const header = w.findAll('th').find((th) => th.text().toLowerCase().includes('log2fc'))
    await header.trigger('click')
    let first = w.findAll('tbody tr')[0].text()
    await header.trigger('click')
    let firstAfter = w.findAll('tbody tr')[0].text()
    expect(first).not.toBe(firstAfter)
  })
})
