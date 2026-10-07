// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DatasetResultsTable from './DatasetResultsTable.vue'

const datasets = [{ accession: 'PXD1', collection: 'msnet', organism: 'Homo sapiens', peptides: 1 }]
const stubs = { DatasetPanel: true }

describe('DatasetResultsTable', () => {
  it('shows the Collection column by default', () => {
    const w = mount(DatasetResultsTable, { props: { datasets }, global: { stubs } })
    expect(w.findAll('thead th').map((t) => t.text())).toContain('Collection')
    expect(w.findAll('tbody tr')[0].findAll('td')).toHaveLength(10)
  })

  it('can hide the Collection column and keeps colspans in sync', async () => {
    const w = mount(DatasetResultsTable, { props: { datasets, showCollection: false }, global: { stubs } })
    expect(w.findAll('thead th').map((t) => t.text())).not.toContain('Collection')
    expect(w.findAll('thead th')).toHaveLength(9)
    await w.find('tbody tr').trigger('click')
    expect(w.find('.panel-row td').attributes('colspan')).toBe('9')
    await w.setProps({ datasets: [] })
    expect(w.find('.empty-cell').attributes('colspan')).toBe('9')
  })
})
