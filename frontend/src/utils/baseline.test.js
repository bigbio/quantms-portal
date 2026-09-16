import { describe, it, expect, vi } from 'vitest'
import { gzipSync } from 'node:zlib'
import { buildIndex, computeStats, createDbLoader, isAlreadyAdded, loadGzipJson, quantile } from './baseline.js'

const entries = [
  { name: 'P04637', gene_name: 'TP53', tags: ['liver'], data: [[1, 2]] },
  { name: 'P50851', gene_name: 'LRBA', tags: ['lung'], data: [[3]] },
]

describe('baseline helpers', () => {
  it('indexes entries by accession and gene name, case-insensitively', () => {
    const idx = buildIndex(entries)
    expect(idx.P04637).toBe(entries[0])
    expect(idx.TP53).toBe(entries[0])
    expect(idx.LRBA.name).toBe('P50851')
  })

  it('downloads each source only once, even for concurrent callers', async () => {
    let resolve
    const fetchSource = vi.fn(() => new Promise((r) => { resolve = r }))
    const loader = createDbLoader(fetchSource)
    const a = loader.get('tissue')
    const b = loader.get('tissue')
    expect(loader.isLoaded('tissue')).toBe(false)
    await Promise.resolve()
    resolve(entries)
    const [dbA, dbB] = await Promise.all([a, b])
    expect(fetchSource).toHaveBeenCalledTimes(1)
    expect(dbA).toBe(dbB)
    expect(dbA.TP53.name).toBe('P04637')
    expect(loader.isLoaded('tissue')).toBe(true)
    await loader.get('tissue')
    expect(fetchSource).toHaveBeenCalledTimes(1)
  })

  it('keeps sources separate and retries after a failed download', async () => {
    const fetchSource = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ a: entries[0] })
    const loader = createDbLoader(fetchSource)
    await expect(loader.get('cell')).rejects.toThrow('offline')
    const db = await loader.get('cell')
    expect(db.P04637).toBe(entries[0])
    expect(fetchSource).toHaveBeenCalledTimes(2)
  })

  it('detects an already-added protein by its resolved accession', () => {
    const proteins = [{ name: 'P04637', gene_name: 'TP53' }]
    expect(isAlreadyAdded(proteins, entries[0])).toBe(true)
    expect(isAlreadyAdded(proteins, entries[1])).toBe(false)
  })

  it('parses both gzip-compressed and plain JSON responses', async () => {
    const payload = [{ name: 'P1' }]
    const gz = gzipSync(Buffer.from(JSON.stringify(payload)))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(gz, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockResolvedValueOnce(new Response('nope', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await expect(loadGzipJson('/a.gz')).resolves.toEqual(payload)
      await expect(loadGzipJson('/a.json')).resolves.toEqual(payload)
      await expect(loadGzipJson('/missing')).rejects.toThrow('404')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('interpolates quantiles (the median of an even count is the midpoint)', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75)
    expect(quantile([7], 0.75)).toBe(7)
    expect(quantile([], 0.5)).toBeNull()
  })

  it('summarises each tag and skips empty or non-numeric values', () => {
    const stats = computeStats({ tags: ['liver', 'lung', 'brain'], data: [[4, 1, 3, 2], [], [5, null, NaN]] })
    expect(stats.liver).toEqual({ min: 1, q1: 1.75, median: 2.5, q3: 3.25, max: 4, count: 4 })
    expect(stats.lung).toBeUndefined()
    expect(stats.brain).toEqual({ min: 5, q1: 5, median: 5, q3: 5, max: 5, count: 1 })
    expect(computeStats(null)).toEqual({})
  })
})
