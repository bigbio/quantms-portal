import { describe, it, expect } from 'vitest'
import {
  regulationClass,
  regulationMeta,
  regulationRank,
  REGULATION_META,
  REGULATION_ORDER,
} from './regulation.js'

describe('regulationClass', () => {
  it('classifies a significant positive fold change as up', () => {
    expect(regulationClass({ log2fc: 1.5, significant: true })).toBe('up')
  })

  it('classifies a significant negative fold change as down', () => {
    expect(regulationClass({ log2fc: -1.5, significant: true })).toBe('down')
  })

  it('classifies a non-significant row as ns regardless of direction', () => {
    expect(regulationClass({ log2fc: 3, significant: false })).toBe('ns')
    expect(regulationClass({ log2fc: -3, significant: false })).toBe('ns')
  })

  it('treats a missing significant flag as ns', () => {
    expect(regulationClass({ log2fc: 2 })).toBe('ns')
    expect(regulationClass({ log2fc: 2, significant: null })).toBe('ns')
  })

  it('treats a null/undefined/NaN log2fc as ns even when significant', () => {
    expect(regulationClass({ log2fc: null, significant: true })).toBe('ns')
    expect(regulationClass({ significant: true })).toBe('ns')
    expect(regulationClass({ log2fc: Number.NaN, significant: true })).toBe('ns')
    expect(regulationClass({ log2fc: 'abc', significant: true })).toBe('ns')
    expect(regulationClass({ log2fc: Infinity, significant: true })).toBe('ns')
  })

  it('treats exactly zero fold change as ns', () => {
    expect(regulationClass({ log2fc: 0, significant: true })).toBe('ns')
    expect(regulationClass({ log2fc: -0, significant: true })).toBe('ns')
  })

  it('handles a null/undefined row', () => {
    expect(regulationClass(null)).toBe('ns')
    expect(regulationClass(undefined)).toBe('ns')
  })

  it('only ever returns a key present in REGULATION_META', () => {
    const rows = [
      { log2fc: 1, significant: true },
      { log2fc: -1, significant: true },
      { log2fc: null, significant: false },
    ]
    for (const row of rows) expect(REGULATION_META[regulationClass(row)]).toBeTruthy()
  })
})

describe('regulationMeta', () => {
  it('returns a distinct label and color per class', () => {
    const up = regulationMeta({ log2fc: 1, significant: true })
    const down = regulationMeta({ log2fc: -1, significant: true })
    const ns = regulationMeta({ log2fc: 1, significant: false })
    expect(up.label).toBe('Up-regulated')
    expect(down.label).toBe('Down-regulated')
    expect(ns.label).toBe('Unchanged')
    expect(new Set([up.color, down.color, ns.color]).size).toBe(3)
  })
})

describe('regulationRank', () => {
  it('ranks up before down before unchanged', () => {
    const up = regulationRank({ log2fc: 1, significant: true })
    const down = regulationRank({ log2fc: -1, significant: true })
    const ns = regulationRank({ log2fc: 1, significant: false })
    expect(up).toBeLessThan(down)
    expect(down).toBeLessThan(ns)
  })

  it('follows REGULATION_ORDER', () => {
    expect(REGULATION_ORDER).toEqual(['up', 'down', 'ns'])
    expect(regulationRank({ log2fc: 1, significant: true })).toBe(0)
  })
})
