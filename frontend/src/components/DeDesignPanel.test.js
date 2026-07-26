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

  it('emits change with defaults on mount', () => {
    const w = mount(DeDesignPanel, { props: { design } })
    const events = w.emitted('change')
    expect(events).toBeTruthy()
    const last = events[events.length - 1][0]
    expect(last).toMatchObject({
      contrast: { id: 'DMSO__vs__Pom', group_a: 'DMSO', group_b: 'Pom', factor: 'compound' },
      method: 'limma',
      normalization: 'median',
      level: 'protein',
    })
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

  it('seeds from initial* props (deep link) instead of the hardcoded defaults', () => {
    // `0h__vs__24h` is NOT the first contrast in `design.contrasts` — picking it
    // proves the panel doesn't just fall back to index 0. Regression test for
    // the deep-link-clobbering bug: the panel used to hardcode
    // method=limma/normalization=median/level=protein and reset
    // selectedContrastId to the first contrast on mount, silently discarding
    // a URL-provided contrast/method/normalization/level.
    const w = mount(DeDesignPanel, {
      props: {
        design,
        initialContrast: '0h__vs__24h',
        initialMethod: 'deqms',
        initialNormalization: 'quantile',
        initialLevel: 'feature',
      },
    })
    const events = w.emitted('change')
    expect(events).toBeTruthy()
    const first = events[0][0]
    expect(first).toMatchObject({
      contrast: { id: '0h__vs__24h', group_a: '0h', group_b: '24h', factor: 'timepoint' },
      method: 'deqms',
      normalization: 'quantile',
      level: 'feature',
    })
    // The factor select should also reflect the seeded contrast's factor,
    // not the first factor in the list.
    expect(w.get('#de-factor').element.value).toBe('timepoint')
  })

  it('re-seeds from initial* props when the parent pushes new values (history nav)', async () => {
    // Regression test for the design panel going stale on in-app history
    // navigation: `initial*` props used to be seeded once at setup and never
    // re-applied, so browser Back/Forward (or a programmatic URL change for
    // the same dataset) left the selects — and the results they drive —
    // stuck on the old values.
    const w = mount(DeDesignPanel, {
      props: {
        design,
        initialContrast: 'DMSO__vs__Pom',
        initialMethod: 'limma',
        initialNormalization: 'median',
        initialLevel: 'protein',
      },
    })
    const mountEvents = w.emitted('change').length

    await w.setProps({
      initialContrast: '0h__vs__24h',
      initialMethod: 'deqms',
      initialNormalization: 'quantile',
      initialLevel: 'feature',
    })

    // Selects reflect the new URL-driven values.
    expect(w.get('#de-factor').element.value).toBe('timepoint')
    expect(w.get('#de-contrast').element.value).toBe('0h__vs__24h')
    expect(w.get('#de-method').element.value).toBe('deqms')
    expect(w.get('#de-normalization').element.value).toBe('quantile')
    expect(w.get('#de-level').element.value).toBe('feature')

    // And a fresh `change` was emitted with the new values.
    const events = w.emitted('change')
    expect(events.length).toBeGreaterThan(mountEvents)
    const last = events[events.length - 1][0]
    expect(last).toMatchObject({
      contrast: { id: '0h__vs__24h', group_a: '0h', group_b: '24h', factor: 'timepoint' },
      method: 'deqms',
      normalization: 'quantile',
      level: 'feature',
    })

    // Setting the SAME values again (the echo-loop case: panel emits -> parent
    // updates refs -> initial* props come back down unchanged) must be a
    // no-op — no extra re-seed, no extra `change`.
    const countBeforeEcho = w.emitted('change').length
    await w.setProps({
      initialContrast: '0h__vs__24h',
      initialMethod: 'deqms',
      initialNormalization: 'quantile',
      initialLevel: 'feature',
    })
    expect(w.emitted('change').length).toBe(countBeforeEcho)
  })

  it('exposes the advanced drawer with method/normalization/level selects', () => {
    const w = mount(DeDesignPanel, { props: { design } })
    expect(w.find('details.de-advanced').exists()).toBe(true)
    expect(w.get('#de-method').findAll('option').map((o) => o.text())).toEqual([
      'limma',
      'deqms',
      'rots',
      'limrots',
      'proda',
    ])
    expect(w.get('#de-normalization').findAll('option').map((o) => o.text())).toEqual([
      'median',
      'quantile',
      'none',
      'loess',
      'rlr',
    ])
    expect(w.get('#de-level').findAll('option').map((o) => o.text())).toEqual(['protein', 'feature'])
  })
})
