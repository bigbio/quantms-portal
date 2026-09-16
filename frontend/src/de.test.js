import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDefault, getDesign } from './de.js'
const ok = (b) => ({ ok: true, status: 200, json: async () => b })
beforeEach(() => { global.fetch = vi.fn() })
afterEach(() => { vi.restoreAllMocks() })
describe('de api', () => {
  it('requests default with contrast param', async () => {
    global.fetch.mockResolvedValueOnce(ok({ rows: [], count: 0 }))
    await getDefault('PXD1/hash', 'A__vs__B')
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('/default')
    expect(url).toContain('contrast=A__vs__B')
  })
})

describe('de api path encoding', () => {
  it('encodes each segment of the dataset ref', async () => {
    global.fetch.mockResolvedValueOnce(ok({ factors: [] }))
    await getDesign('PXD1/a b?c')
    expect(global.fetch.mock.calls[0][0]).toContain('/de/PXD1/a%20b%3Fc/design')
  })
})

describe('de api surface', () => {
  it('only exposes the precomputed-result endpoints', async () => {
    const api = await import('./de.js')
    expect(Object.keys(api).sort()).toEqual(['getDefault', 'getDesign', 'getQc', 'listDatasets'])
  })
})
