// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QxColourBy from './QxColourBy.vue'

const props = {
  fields: [{ key: 'organism_part', title: 'Organism part', distinct: 2 }, { key: 'disease', title: 'Disease', distinct: 2 }],
  modelValue: 'organism_part',
  legend: [{ label: 'liver', colour: '#1baf7a', n: 6, family: 'Digestive system' }, { label: 'ascites', colour: '#a3acb6', n: 9 }],
}
const last = (w) => w.emitted('update:highlight').at(-1)[0]

describe('QxColourBy', () => {
  it('keeps a clicked key highlighted until it is clicked again', async () => {
    const w = mount(QxColourBy, { props })
    const key = w.findAll('.cb-key')[0]
    await key.trigger('mouseenter')
    await w.find('.cb-legend').trigger('mouseleave')
    expect(last(w)).toBe('')
    await key.trigger('click')
    expect(last(w)).toBe('liver')
    expect(key.attributes('aria-pressed')).toBe('true')
    // hovering another key shows it; leaving the legend goes back to the kept one
    await w.findAll('.cb-key')[1].trigger('mouseenter')
    expect(last(w)).toBe('ascites')
    await w.find('.cb-legend').trigger('mouseleave')
    expect(last(w)).toBe('liver')
    await key.trigger('click')
    expect(last(w)).toBe('')
  })

  it('keeps the highlight the page already has, and drops it when the field changes', async () => {
    const w = mount(QxColourBy, { props: { ...props, highlight: 'Digestive system' } })
    expect(w.find('.cb-family').attributes('aria-pressed')).toBe('true')
    await w.setProps({ modelValue: 'disease' })
    expect(w.find('.cb-family').attributes('aria-pressed')).toBe('false')
  })
})
