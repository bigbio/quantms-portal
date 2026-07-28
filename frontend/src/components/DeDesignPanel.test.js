// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeDesignPanel, { contrastsForFactor } from './DeDesignPanel.vue'

describe('contrast enumeration', () => {
  it('lists pairs for the chosen factor', () => {
    const design = {
      factors: [{ name: 'compound', levels: ['DMSO', 'Pom'] }],
      contrasts: [{ id: 'DMSO__vs__Pom', group_a: 'DMSO', group_b: 'Pom', factor: 'compound' }],
    }
    expect(contrastsForFactor(design, 'compound')).toEqual([
      { id: 'DMSO__vs__Pom', group_a: 'DMSO', group_b: 'Pom', factor: 'compound' },
    ])
  })

  it('filters out contrasts belonging to other factors', () => {
    const design = {
      factors: [{ name: 'compound', levels: ['DMSO', 'Pom'] }, { name: 'timepoint', levels: ['0h', '24h'] }],
      contrasts: [
        { id: 'DMSO__vs__Pom', group_a: 'DMSO', group_b: 'Pom', factor: 'compound' },
        { id: '0h__vs__24h', group_a: '0h', group_b: '24h', factor: 'timepoint' },
      ],
    }
    expect(contrastsForFactor(design, 'timepoint')).toEqual([
      { id: '0h__vs__24h', group_a: '0h', group_b: '24h', factor: 'timepoint' },
    ])
  })

  it('returns an empty array when design or contrasts are missing', () => {
    expect(contrastsForFactor(undefined, 'compound')).toEqual([])
    expect(contrastsForFactor({}, 'compound')).toEqual([])
  })
})

describe('DeDesignPanel', () => {
  const design = {
    factors: [
      { name: 'compound', levels: ['DMSO', 'Pom'] },
      { name: 'timepoint', levels: ['0h', '24h'] },
    ],
    contrasts: [
      { id: 'DMSO__vs__Pom', group_a: 'DMSO', group_b: 'Pom', factor: 'compound' },
      { id: '0h__vs__24h', group_a: '0h', group_b: '24h', factor: 'timepoint' },
    ],
  }

  it('renders factor and contrast selects with defaults', () => {
    const w = mount(DeDesignPanel, { props: { design } })
    const factorSelect = w.get('#de-factor')
    const contrastSelect = w.get('#de-contrast')
    expect(factorSelect.findAll('option').map((o) => o.text())).toEqual(['compound', 'timepoint'])
    expect(contrastSelect.findAll('option').map((o) => o.text())).toEqual(['DMSO vs Pom'])
  })

  it('emits change with the default contrast on mount (contrast only)', () => {
    const w = mount(DeDesignPanel, { props: { design } })
    const events = w.emitted('change')
    expect(events).toBeTruthy()
    const last = events[events.length - 1][0]
    // Method/normalization/level are chosen per dataset by the backend QC gate,
    // so the panel navigates biology only — it emits just the contrast.
    expect(last).toEqual({
      contrast: { id: 'DMSO__vs__Pom', group_a: 'DMSO', group_b: 'Pom', factor: 'compound' },
    })
    expect(last).not.toHaveProperty('method')
  })

  it('updates the contrast options when the factor changes', async () => {
    const w = mount(DeDesignPanel, { props: { design } })
    await w.get('#de-factor').setValue('timepoint')
    const contrastSelect = w.get('#de-contrast')
    expect(contrastSelect.findAll('option').map((o) => o.text())).toEqual(['0h vs 24h'])
    const events = w.emitted('change')
    const last = events[events.length - 1][0]
    expect(last.contrast).toEqual({ id: '0h__vs__24h', group_a: '0h', group_b: '24h', factor: 'timepoint' })
  })

  it('seeds from the initial-contrast prop (deep link) instead of index 0', () => {
    // `0h__vs__24h` is NOT the first contrast in `design.contrasts` — picking it
    // proves the panel honours a URL-provided contrast instead of resetting to
    // the first one on mount.
    const w = mount(DeDesignPanel, {
      props: { design, initialContrast: '0h__vs__24h' },
    })
    const events = w.emitted('change')
    expect(events).toBeTruthy()
    const first = events[0][0]
    expect(first).toEqual({
      contrast: { id: '0h__vs__24h', group_a: '0h', group_b: '24h', factor: 'timepoint' },
    })
    // The factor select should also reflect the seeded contrast's factor,
    // not the first factor in the list.
    expect(w.get('#de-factor').element.value).toBe('timepoint')
  })

  it('re-seeds from the initial-contrast prop when the parent pushes a new value (history nav)', async () => {
    // Regression test for the panel going stale on in-app history navigation:
    // browser Back/Forward (or a programmatic URL change for the same dataset)
    // must re-apply the contrast, not stay stuck on the old value.
    const w = mount(DeDesignPanel, {
      props: { design, initialContrast: 'DMSO__vs__Pom' },
    })
    const mountEvents = w.emitted('change').length

    await w.setProps({ initialContrast: '0h__vs__24h' })

    expect(w.get('#de-factor').element.value).toBe('timepoint')
    expect(w.get('#de-contrast').element.value).toBe('0h__vs__24h')

    const events = w.emitted('change')
    expect(events.length).toBeGreaterThan(mountEvents)
    const last = events[events.length - 1][0]
    expect(last).toEqual({
      contrast: { id: '0h__vs__24h', group_a: '0h', group_b: '24h', factor: 'timepoint' },
    })

    // Setting the SAME value again (the echo-loop case: panel emits -> parent
    // updates ref -> initial-contrast comes back down unchanged) must be a
    // no-op — no extra re-seed, no extra `change`.
    const countBeforeEcho = w.emitted('change').length
    await w.setProps({ initialContrast: '0h__vs__24h' })
    expect(w.emitted('change').length).toBe(countBeforeEcho)
  })

  it('does NOT expose method/normalization/level selectors (analysis is fixed per dataset)', () => {
    const w = mount(DeDesignPanel, { props: { design } })
    expect(w.find('details.de-advanced').exists()).toBe(false)
    expect(w.find('#de-method').exists()).toBe(false)
    expect(w.find('#de-normalization').exists()).toBe(false)
    expect(w.find('#de-level').exists()).toBe(false)
  })
})
