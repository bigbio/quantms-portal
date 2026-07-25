import { describe, it, expect } from 'vitest'
import { formatBig, formatNum, formatBytes, cleanInstrument } from './format.js'

describe('formatBig', () => {
  it('abbreviates with K/M/B and trims trailing .0', () => {
    expect(formatBig(500)).toBe('500')
    expect(formatBig(1000)).toBe('1K')
    expect(formatBig(1500)).toBe('1.5K')
    expect(formatBig(2_000_000)).toBe('2M')
    expect(formatBig(1_500_000_000)).toBe('1.5B')
  })
  it('returns an em-dash for null/NaN', () => {
    expect(formatBig(null)).toBe('—')
    expect(formatBig('')).toBe('—')
    expect(formatBig('nope')).toBe('—')
  })
})

describe('formatNum', () => {
  it('em-dashes null/zero, formats real numbers', () => {
    expect(formatNum(0)).toBe('—')
    expect(formatNum(null)).toBe('—')
    expect(formatNum(1234)).not.toBe('—')
    expect(formatNum(1234)).toMatch(/1.?234/) // locale separator tolerant
  })
})

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(0)).toBe('—')
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(15 * 1024)).toBe('15 KB') // >=10 -> 0 decimals
  })
})

describe('cleanInstrument', () => {
  it('extracts the NT= human name when present', () => {
    expect(cleanInstrument('AC=MS:1002732;NT=Orbitrap Fusion Lumos')).toBe('Orbitrap Fusion Lumos')
    expect(cleanInstrument('Q Exactive Plus')).toBe('Q Exactive Plus')
    expect(cleanInstrument('')).toBe('')
    expect(cleanInstrument(null)).toBe('')
  })
})
