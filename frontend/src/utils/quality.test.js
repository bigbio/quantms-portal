import { describe, it, expect } from 'vitest'
import {
  QUALITY_META,
  POWER_META,
  QUALITY_ORDER,
  POWER_ORDER,
  qualityLevel,
  powerLevel,
  qualityMeta,
  powerMeta,
  qualityRank,
  powerRank,
  classificationReasons,
  badgeTitle,
} from './quality.js'

describe('qualityLevel', () => {
  it('recognizes every published data-quality level', () => {
    expect(qualityLevel('high')).toBe('high')
    expect(qualityLevel('medium')).toBe('medium')
    expect(qualityLevel('low')).toBe('low')
  })

  it('reads the level out of a backend classification object', () => {
    expect(qualityLevel({ level: 'medium', reasons: ['missingness 0.31'] })).toBe('medium')
  })

  it('normalizes case and surrounding whitespace', () => {
    expect(qualityLevel(' HIGH ')).toBe('high')
  })

  it('falls back to unknown for null/undefined/empty/unrecognized input', () => {
    expect(qualityLevel(null)).toBe('unknown')
    expect(qualityLevel(undefined)).toBe('unknown')
    expect(qualityLevel('')).toBe('unknown')
    expect(qualityLevel('excellent')).toBe('unknown')
    expect(qualityLevel(3)).toBe('unknown')
    expect(qualityLevel({})).toBe('unknown')
    expect(qualityLevel({ level: null })).toBe('unknown')
  })
})

describe('powerLevel', () => {
  it('recognizes every published statistical-power level', () => {
    expect(powerLevel('strong')).toBe('strong')
    expect(powerLevel('moderate')).toBe('moderate')
    expect(powerLevel('limited')).toBe('limited')
  })

  it('reads the level out of a backend classification object', () => {
    expect(powerLevel({ level: 'moderate', min_replicates: 3 })).toBe('moderate')
  })

  it('falls back to unknown for null/undefined/unrecognized input', () => {
    expect(powerLevel(null)).toBe('unknown')
    expect(powerLevel(undefined)).toBe('unknown')
    expect(powerLevel('weak')).toBe('unknown')
    expect(powerLevel({})).toBe('unknown')
  })
})

describe('qualityMeta / powerMeta', () => {
  it('returns a populated entry for every level, including unknown', () => {
    for (const level of QUALITY_ORDER) {
      const m = qualityMeta(level)
      expect(m.key).toBe(level)
      expect(m.label).toBeTruthy()
      expect(m.short).toBeTruthy()
      expect(m.description).toBeTruthy()
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
    for (const level of POWER_ORDER) {
      const m = powerMeta(level)
      expect(m.key).toBe(level)
      expect(m.label).toBeTruthy()
      expect(m.short).toBeTruthy()
      expect(m.description).toBeTruthy()
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('never returns undefined for a null or garbage level', () => {
    expect(qualityMeta(null).key).toBe('unknown')
    expect(powerMeta(undefined).key).toBe('unknown')
    expect(qualityMeta('nonsense').short).toBe('Unknown')
  })

  it('keeps the two axes independent: high quality does not imply strong power', () => {
    // PXD041047: pristine measurements, only n=3 per group.
    expect(qualityMeta('high').key).toBe('high')
    expect(powerMeta('moderate').key).toBe('moderate')
    expect(qualityMeta('high').label).not.toBe(powerMeta('moderate').label)
  })

  it('greys out only the unknown level, so grey never reads as a verdict', () => {
    const grey = QUALITY_META.unknown.color
    expect(POWER_META.unknown.color).toBe(grey)
    for (const level of ['high', 'medium', 'low']) {
      expect(QUALITY_META[level].color).not.toBe(grey)
    }
    for (const level of ['strong', 'moderate', 'limited']) {
      expect(POWER_META[level].color).not.toBe(grey)
    }
  })
})

describe('qualityRank / powerRank', () => {
  it('ranks best first and sinks unknown to the bottom', () => {
    expect(qualityRank('high')).toBeLessThan(qualityRank('medium'))
    expect(qualityRank('medium')).toBeLessThan(qualityRank('low'))
    expect(qualityRank('low')).toBeLessThan(qualityRank(null))
    expect(powerRank('strong')).toBeLessThan(powerRank('moderate'))
    expect(powerRank('moderate')).toBeLessThan(powerRank('limited'))
    expect(powerRank('limited')).toBeLessThan(powerRank(null))
  })

  it('follows the declared order arrays', () => {
    expect(QUALITY_ORDER).toEqual(['high', 'medium', 'low', 'unknown'])
    expect(POWER_ORDER).toEqual(['strong', 'moderate', 'limited', 'unknown'])
  })
})

describe('classificationReasons', () => {
  it('returns the backend reasons as trimmed strings', () => {
    expect(classificationReasons({ level: 'moderate', reasons: [' only 3 replicates '] })).toEqual([
      'only 3 replicates',
    ])
  })

  it('returns an empty array for a bare level, empty reasons or malformed input', () => {
    expect(classificationReasons('high')).toEqual([])
    expect(classificationReasons({ level: 'high', reasons: [] })).toEqual([])
    expect(classificationReasons({ level: 'high' })).toEqual([])
    expect(classificationReasons(null)).toEqual([])
    expect(classificationReasons({ reasons: 'nope' })).toEqual([])
    expect(classificationReasons({ reasons: [null, '', '  ', 'kept'] })).toEqual(['kept'])
  })
})

describe('badgeTitle', () => {
  it('describes the level so the badge is not colour-only', () => {
    const t = badgeTitle(qualityMeta('high'), 'high')
    expect(t).toContain('High data quality')
    expect(t).toContain(QUALITY_META.high.description)
  })

  it('appends the backend reasons when present', () => {
    const block = { level: 'moderate', reasons: ['only 3 replicates in the smallest group'] }
    const t = badgeTitle(powerMeta(block), block)
    expect(t).toContain('Moderate statistical power')
    expect(t).toContain('only 3 replicates in the smallest group')
  })
})
