import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDefault, runDe } from './de.js'
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

describe('runDe', () => {
  it('resolves normally on a fast, successful response', async () => {
    global.fetch.mockResolvedValueOnce(ok({ rows: [{ protein: 'P1' }], count: 1 }))
    const res = await runDe('PXD1/hash', { contrast: 'A__vs__B', method: 'limma' })
    expect(res).toEqual({ rows: [{ protein: 'P1' }], count: 1 })
  })

  it('keeps the existing non-ok .status behavior', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 422 })
    await expect(runDe('PXD1/hash', { contrast: 'A__vs__B' })).rejects.toMatchObject({ status: 422 })
  })

  it('aborts and throws a status=0 timeout error once the timeout elapses', async () => {
    vi.useFakeTimers()
    global.fetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const e = new Error('The operation was aborted')
        e.name = 'AbortError'
        reject(e)
      })
    }))

    const pending = runDe('PXD1/hash', { contrast: 'A__vs__B' }, { timeout: 5000 })
    const assertion = expect(pending).rejects.toMatchObject({ status: 0 })
    await vi.advanceTimersByTimeAsync(5000)
    await assertion

    vi.useRealTimers()
  })
})
