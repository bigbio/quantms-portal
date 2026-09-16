import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCredits } from './citation.js'

afterEach(() => vi.restoreAllMocks())

describe('getCredits', () => {
  it('queries the gateway with the joined refs through apiGet', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ credits: [] }) })
    await expect(getCredits(['A/1', '', 'B/2'])).resolves.toEqual({ credits: [] })
    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toMatch(/\/credits\?refs=A%2F1%2CB%2F2$/)
    expect(init.signal).toBeDefined()
  })

  it('skips the request when there are no refs', async () => {
    global.fetch = vi.fn()
    await expect(getCredits([])).resolves.toMatchObject({ credits: [] })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
