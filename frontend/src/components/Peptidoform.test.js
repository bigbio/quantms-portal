// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QxTable from './QxTable.vue'

describe('peptidoforms in QxTable', () => {
  const rows = [['MDIYEQMEEIVINGK', '[UNIMOD:737]-MDIYEQM[Oxidation]EEIVINGK'], ['PEPTIDE', 'PEPTIDE']]

  it('colours modified residues and names each modification in a legend', () => {
    const w = mount(QxTable, { props: { columns: ['sequence', 'peptidoform'], rows } })
    const mod = w.findAll('.pf-mod')
    expect(mod).toHaveLength(1)
    expect(mod[0].text()).toBe('M')
    expect(mod[0].attributes('title')).toBe('M7 · Oxidation')
    expect(w.find('.pf-term').attributes('title')).toBe('N-term · TMT6plex (UNIMOD:737)')
    expect(w.findAll('.qt-mods li').map((li) => li.text())).toEqual(['TMT6plex', 'Oxidation'])
    expect(w.findAll('.pf')[1].text()).toBe('PEPTIDE')
  })

  it('shows no legend when the table has no peptidoform column', () => {
    const w = mount(QxTable, { props: { columns: ['sequence'], rows: [['PEPTIDE']] } })
    expect(w.find('.qt-mods').exists()).toBe(false)
  })
})
