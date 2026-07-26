// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DePicker from './DePicker.vue'
import QualityBadges from './QualityBadges.vue'

const classified = [
  {
    ref: 'PXD041047/9c3873d590d7',
    accession: 'PXD041047',
    title: 'PXD041047',
    organism: 'Homo sapiens',
    n_samples: 6,
    factors: ['compound'],
    quality: 'pass',
    data_quality: 'high',
    statistical_power: 'moderate',
  },
  {
    ref: 'PXD000001/abc',
    accession: 'PXD000001',
    organism: 'Homo sapiens',
    n_samples: 4,
    factors: ['treatment'],
    quality: 'warn',
    data_quality: 'medium',
    statistical_power: 'limited',
  },
]

// Datasets built before the classification existed carry null levels.
const unclassified = [
  {
    ref: 'PXD999999/old',
    accession: 'PXD999999',
    organism: 'Mus musculus',
    n_samples: 8,
    factors: [],
    data_quality: null,
    statistical_power: null,
  },
]

describe('DePicker quality column', () => {
  it('renders a compact badge pair per dataset row', () => {
    const w = mount(DePicker, { props: { datasets: classified } })
    const badges = w.findAllComponents(QualityBadges)
    expect(badges).toHaveLength(2)
    expect(badges[0].props('compact')).toBe(true)
    expect(badges[0].text()).toContain('High')
    expect(badges[0].text()).toContain('Moderate')
    expect(badges[1].text()).toContain('Medium')
    expect(badges[1].text()).toContain('Limited')
  })

  it('renders Unknown badges for datasets built before the classification existed', () => {
    const w = mount(DePicker, { props: { datasets: unclassified } })
    const badges = w.findAllComponents(QualityBadges)
    expect(badges).toHaveLength(1)
    expect(badges[0].text()).toContain('Unknown')
    // The row itself is unaffected and still selectable.
    expect(w.text()).toContain('PXD999999')
    expect(w.findAll('.de-row')).toHaveLength(1)
  })

  it('still emits select with the dataset ref', async () => {
    const w = mount(DePicker, { props: { datasets: classified } })
    await w.findAll('.de-row')[0].trigger('click')
    expect(w.emitted('select')[0]).toEqual(['PXD041047/9c3873d590d7'])
  })

  it('handles an empty and a loading state', () => {
    expect(mount(DePicker, { props: { datasets: [] } }).text()).toContain('No datasets available')
    expect(mount(DePicker, { props: { datasets: [], loading: true } }).text()).toContain('Loading')
  })
})

describe('DePicker high-quality filter', () => {
  it('narrows the table to high data quality datasets when toggled', async () => {
    const w = mount(DePicker, { props: { datasets: classified } })
    expect(w.findAll('.de-row')).toHaveLength(2)
    await w.find('.de-filter input').setValue(true)
    const rows = w.findAll('.de-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('PXD041047')
  })

  it('explains an empty result rather than looking broken', async () => {
    const w = mount(DePicker, { props: { datasets: [classified[1]] } })
    await w.find('.de-filter input').setValue(true)
    expect(w.findAll('.de-row')).toHaveLength(0)
    expect(w.text()).toContain('No datasets match the high data quality filter')
  })

  it('hides the filter when nothing is classified, so it cannot only empty the table', () => {
    const w = mount(DePicker, { props: { datasets: unclassified } })
    expect(w.find('.de-filter').exists()).toBe(false)
  })
})
