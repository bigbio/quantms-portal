import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import { getPeptideStats, resetPeptideStatsCache } from './peptideStats.js'

describe('getPeptideStats', () => {
  beforeEach(() => {
    apiGet.mockReset()
    resetPeptideStatsCache()
  })

  it('fetches /stats once for concurrent and later callers', async () => {
    apiGet.mockResolvedValue({ total_datasets: 3 })
    const [a, b] = await Promise.all([getPeptideStats(), getPeptideStats()])
    const c = await getPeptideStats()
    expect(a).toBe(b)
    expect(c).toBe(a)
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet.mock.calls[0][1]).toBe('/stats')
  })

  it('does not cache a failure', async () => {
    apiGet.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ ok: 1 })
    await expect(getPeptideStats()).rejects.toThrow('down')
    await expect(getPeptideStats()).resolves.toEqual({ ok: 1 })
    expect(apiGet).toHaveBeenCalledTimes(2)
  })
})
