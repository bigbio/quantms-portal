import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiGet, ApiError } from './api.js'

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
