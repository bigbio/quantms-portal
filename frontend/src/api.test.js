import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiGet, ApiError, encodePath } from './api.js'

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const err = (status) => ({ ok: false, status, json: async () => ({}) })

beforeEach(() => {
  global.fetch = vi.fn()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiGet', () => {
  it('returns parsed JSON on 200', async () => {
    global.fetch.mockResolvedValueOnce(ok({ hello: 'world' }))
    await expect(apiGet('http://b', '/x')).resolves.toEqual({ hello: 'world' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('drops empty/null/undefined query params, keeps real ones', async () => {
    global.fetch.mockResolvedValueOnce(ok({}))
    await apiGet('http://b', '/x', { a: 1, b: '', c: null, d: undefined, e: 'v' })
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('a=1')
    expect(url).toContain('e=v')
    expect(url).not.toMatch(/[?&]b=/)
    expect(url).not.toMatch(/[?&]c=/)
    expect(url).not.toMatch(/[?&]d=/)
  })

  it('throws ApiError with status on 4xx and does NOT retry', async () => {
    global.fetch.mockResolvedValue(err(404))
    await expect(apiGet('http://b', '/x')).rejects.toMatchObject({ status: 404 })
    await expect(apiGet('http://b', '/y')).rejects.toBeInstanceOf(ApiError)
    // one call per apiGet (no retry on 4xx)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('retries once on 5xx, then succeeds', async () => {
    global.fetch.mockResolvedValueOnce(err(503)).mockResolvedValueOnce(ok({ ok: 1 }))
    await expect(apiGet('http://b', '/x')).resolves.toEqual({ ok: 1 })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('retries once on a network error, then succeeds', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok({ r: 2 }))
    await expect(apiGet('http://b', '/x')).resolves.toEqual({ r: 2 })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up after exhausting retries on persistent 5xx', async () => {
    global.fetch.mockResolvedValue(err(500))
    await expect(apiGet('http://b', '/x')).rejects.toMatchObject({ status: 500 })
    expect(global.fetch).toHaveBeenCalledTimes(2) // initial + 1 retry
  })
})

describe('apiGet timeouts and aborts', () => {
  afterEach(() => vi.useRealTimers())

  // A response whose body never finishes unless the request is aborted.
  const stalledBody = (signal) => ({
    ok: true,
    status: 200,
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }),
  })

  it('times out while reading a stalled body', async () => {
    vi.useFakeTimers()
    global.fetch.mockImplementation(async (_url, init) => stalledBody(init.signal))
    const p = apiGet('http://b', '/x', null, { timeout: 1000 })
    const assertion = expect(p).rejects.toMatchObject({ name: 'ApiError', status: 0, message: expect.stringContaining('timed out') })
    await vi.advanceTimersByTimeAsync(1001)
    await assertion
  })

  it('removes its listener from an external signal once done', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    global.fetch.mockResolvedValueOnce(ok({ a: 1 }))
    await apiGet('http://b', '/x', null, { signal: controller.signal })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('reports an external abort during the body read as an abort, not bad JSON', async () => {
    const controller = new AbortController()
    global.fetch.mockImplementation(async (_url, init) => stalledBody(init.signal))
    const p = apiGet('http://b', '/x', null, { signal: controller.signal })
    await Promise.resolve()
    controller.abort()
    await expect(p).rejects.toMatchObject({ status: 0, message: expect.stringContaining('aborted') })
    await p.catch((e) => expect(e).toBeInstanceOf(ApiError))
  })
})

describe('encodePath', () => {
  it('encodes each segment but keeps separators', () => {
    expect(encodePath('PXD1/abc')).toBe('PXD1/abc')
    expect(encodePath('a b/c?d#e')).toBe('a%20b/c%3Fd%23e')
    expect(encodePath('../x')).toBe('../x')
    expect(encodePath(null)).toBe('')
  })
})
