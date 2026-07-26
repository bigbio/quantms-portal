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

// A fully enriched entry as served today by /de/datasets.
const enriched = [
  {
    ref: 'PXD041047/9c3873d590d7',
    accession: 'PXD041047',
    title: 'ChemBioID - An integrated chemical biology workflow',
    summary: 'A study on pomalidomide-induced target proximity using TurboID.',
    organism: 'Homo sapiens',
    n_samples: 6,
    factors: ['compound'],
    contrasts: [
      { id: 'DMSO__vs__Pomalidomide', label: 'DMSO vs Pomalidomide', factor: 'compound' },
    ],
    n_contrasts: 1,
    context: {
      cell_line: 'TurboID-CRBN HEK293 Flp-In',
      instrument: 'Orbitrap Fusion Lumos',
      acquisition: 'Data-independent acquisition',
      label: 'label free sample',
    },
    results: { n_quantified: 4094, n_significant: 20, n_on_off: 66 },
    data_quality: 'high',
    statistical_power: 'moderate',
    quality: 'pass',
  },
]

// Everything past ref/accession is optional — datasets still rebuilding look
// like this and must not render placeholders.
const minimal = [{ ref: 'PXD777777/xyz', accession: 'PXD777777' }]

describe('DePicker enriched metadata', () => {
  it('renders title, accession, summary, contrast, results and context', () => {
    const w = mount(DePicker, { props: { datasets: enriched } })
    const text = w.text()
    expect(text).toContain('ChemBioID - An integrated chemical biology workflow')
    expect(w.find('.de-acc').text()).toBe('PXD041047')
    expect(text).toContain('pomalidomide-induced target proximity')
    expect(text).toContain('Homo sapiens')
    expect(text).toContain('6 samples')

    const chips = w.findAll('.de-contrast-chip')
    expect(chips).toHaveLength(1)
    expect(chips[0].text()).toBe('DMSO vs Pomalidomide')

    const results = w.find('.de-card-results').text().replace(/\s+/g, ' ')
    expect(results).toContain('4,094 quantified')
    expect(results).toContain('20 significant')
    expect(results).toContain('66 on/off')

    const ctx = w.findAll('.de-context-chip').map((c) => c.text())
    expect(ctx).toEqual([
      'TurboID-CRBN HEK293 Flp-In',
      'Orbitrap Fusion Lumos',
      'Data-independent acquisition',
      'label free sample',
    ])
  })

  it('explains on/off proteins on hover rather than leaving the term bare', () => {
    const w = mount(DePicker, { props: { datasets: enriched } })
    const titles = w.findAll('.de-card-results [title]').map((s) => s.attributes('title'))
    expect(titles.some((t) => /absent in the other/.test(t))).toBe(true)
  })

  it('caps the contrast chips at three and counts the rest', () => {
    const many = [
      {
        ...enriched[0],
        n_contrasts: 5,
        contrasts: ['a', 'b', 'c', 'd', 'e'].map((x) => ({
          id: `${x}__vs__ctrl`,
          label: `${x} vs ctrl`,
        })),
      },
    ]
    const w = mount(DePicker, { props: { datasets: many } })
    expect(w.findAll('.de-contrast-chip')).toHaveLength(3)
    expect(w.find('.de-contrast-more').text()).toBe('+2 more')
  })

  it('renders a minimal entry without placeholders or errors', () => {
    const w = mount(DePicker, { props: { datasets: minimal } })
    const text = w.text()
    expect(w.findAll('.de-row')).toHaveLength(1)
    expect(text).toContain('PXD777777')
    expect(text).not.toMatch(/undefined|null|NaN/)
    expect(w.find('.de-card-summary').exists()).toBe(false)
    expect(w.find('.de-contrasts').exists()).toBe(false)
    expect(w.find('.de-card-results').exists()).toBe(false)
    expect(w.find('.de-context').exists()).toBe(false)
    // Still selectable.
    expect(w.findComponent(QualityBadges).exists()).toBe(true)
  })

  it('falls back to the accession when a dataset has no title', () => {
    const w = mount(DePicker, { props: { datasets: minimal } })
    expect(w.find('.de-card-title').text()).toBe('PXD777777')
  })
})

describe('DePicker free-text filter', () => {
  const mixed = [...enriched, { ref: 'PXD000002/m', accession: 'PXD000002', organism: 'Mus musculus' }]

  it('narrows by title, accession, organism or contrast label', async () => {
    const w = mount(DePicker, { props: { datasets: mixed } })
    expect(w.findAll('.de-row')).toHaveLength(2)

    await w.find('.de-search').setValue('pomalidomide')
    expect(w.findAll('.de-row')).toHaveLength(1)
    expect(w.findAll('.de-row')[0].text()).toContain('PXD041047')

    await w.find('.de-search').setValue('mus')
    expect(w.findAll('.de-row')).toHaveLength(1)
    expect(w.findAll('.de-row')[0].text()).toContain('PXD000002')

    await w.find('.de-search').setValue('')
    expect(w.findAll('.de-row')).toHaveLength(2)
  })

  it('explains an empty search result', async () => {
    const w = mount(DePicker, { props: { datasets: mixed } })
    await w.find('.de-search').setValue('zzz')
    expect(w.findAll('.de-row')).toHaveLength(0)
    expect(w.text()).toContain('No datasets match')
    expect(w.text()).toContain('zzz')
  })

  it('combines with the high data quality filter', async () => {
    const w = mount(DePicker, { props: { datasets: mixed } })
    await w.find('.de-filter input').setValue(true)
    expect(w.findAll('.de-row')).toHaveLength(1)
    await w.find('.de-search').setValue('mus')
    expect(w.findAll('.de-row')).toHaveLength(0)
  })
})
