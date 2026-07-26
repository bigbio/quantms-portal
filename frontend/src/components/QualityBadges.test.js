// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QualityBadges from './QualityBadges.vue'

describe('QualityBadges', () => {
  it('renders two independent badges, never one combined grade', () => {
    const w = mount(QualityBadges, {
      props: { dataQuality: 'high', power: 'moderate' },
    })
    const badges = w.findAll('.quality-badge')
    expect(badges).toHaveLength(2)
    expect(badges[0].text()).toContain('High')
    expect(badges[1].text()).toContain('Moderate')
    expect(badges[0].classes()).toContain('quality-badge--q-high')
    expect(badges[1].classes()).toContain('quality-badge--p-moderate')
  })

  it('labels both axes so the pair cannot be read as one score', () => {
    const w = mount(QualityBadges, { props: { dataQuality: 'high', power: 'moderate' } })
    expect(w.text()).toContain('Data quality')
    expect(w.text()).toContain('Statistical power')
  })

  it('accepts the backend classification objects and surfaces their reasons', () => {
    const w = mount(QualityBadges, {
      props: {
        dataQuality: { level: 'high', reasons: [] },
        power: {
          level: 'moderate',
          min_replicates: 3,
          per_group: { DMSO: 3, Pomalidomide: 3 },
          reasons: ['only 3 replicates in the smallest group; FDR correction limits detectable changes'],
        },
      },
    })
    const badges = w.findAll('.quality-badge')
    expect(badges[0].text()).toContain('High')
    expect(badges[1].text()).toContain('Moderate')
    // The description + reason ride on title/aria-label, so the level is never
    // conveyed by colour alone.
    const title = badges[1].attributes('title')
    expect(title).toContain('Moderate statistical power')
    expect(title).toContain('only 3 replicates in the smallest group')
    expect(badges[1].attributes('aria-label')).toBe(title)
  })

  it('degrades to Unknown badges when the classification is absent (older datasets)', () => {
    const w = mount(QualityBadges, { props: { dataQuality: null, power: null } })
    const badges = w.findAll('.quality-badge')
    expect(badges).toHaveLength(2)
    expect(badges[0].text()).toContain('Unknown')
    expect(badges[1].text()).toContain('Unknown')
    expect(badges[0].classes()).toContain('quality-badge--q-unknown')
    expect(badges[1].classes()).toContain('quality-badge--p-unknown')
  })

  it('renders with no props at all without throwing', () => {
    const w = mount(QualityBadges)
    expect(w.findAll('.quality-badge')).toHaveLength(2)
  })

  it('drops the axis captions in compact mode but keeps the level text', () => {
    const w = mount(QualityBadges, {
      props: { dataQuality: 'low', power: 'limited', compact: true },
    })
    expect(w.find('.quality-badges--compact').exists()).toBe(true)
    expect(w.find('.quality-badge-axis').exists()).toBe(false)
    expect(w.text()).toContain('Low')
    expect(w.text()).toContain('Limited')
    // The full description is still available to screen readers / on hover.
    expect(w.findAll('.quality-badge')[0].attributes('aria-label')).toContain('Low data quality')
  })
})
