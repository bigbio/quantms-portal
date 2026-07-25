import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDefault } from './de.js'
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
