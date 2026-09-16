// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyText } from './clipboard.js'

afterEach(() => {
  vi.unstubAllGlobals()
  delete document.execCommand
})

describe('copyText', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when the Clipboard API is missing or rejects', async () => {
    document.execCommand = vi.fn(() => true)
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    await expect(copyText('a')).resolves.toBe(true)
    vi.stubGlobal('navigator', {})
    await expect(copyText('b')).resolves.toBe(true)
    expect(document.execCommand).toHaveBeenCalledTimes(2)
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('reports failure without throwing', async () => {
    vi.stubGlobal('navigator', {})
    document.execCommand = vi.fn(() => false)
    await expect(copyText('x')).resolves.toBe(false)
    await expect(copyText('')).resolves.toBe(false)
  })
})
