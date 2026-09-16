import { describe, it, expect, vi } from 'vitest'
import { createBaselineClient } from './baselineClient.js'

vi.mock('./baseline.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, loadGzipJson: vi.fn(async () => [{ name: 'P04637', gene_name: 'TP53' }]) }
})
import { loadGzipJson } from './baseline.js'

function fakeWorker(respond) {
  const w = { posted: [], terminate: vi.fn() }
  w.postMessage = (msg) => {
    w.posted.push(msg)
    queueMicrotask(() => w.onmessage({ data: respond(msg) }))
  }
  return w
}

describe('createBaselineClient', () => {
  it('resolves lookups through the worker and tracks loaded sources', async () => {
    const w = fakeWorker((m) => ({ id: m.id, entry: m.query === 'TP53' ? { name: 'P04637' } : null }))
    const client = createBaselineClient({ base: '/x/', createWorker: () => w })
    expect(client.isLoaded('tissue')).toBe(false)
    await expect(client.lookup('tissue', 'TP53')).resolves.toEqual({ name: 'P04637' })
    await expect(client.lookup('tissue', 'NOPE')).resolves.toBeNull()
    expect(client.isLoaded('tissue')).toBe(true)
    expect(client.isLoaded('cell')).toBe(false)
    expect(w.posted[0]).toMatchObject({ source: 'tissue', query: 'TP53', base: '/x/' })
  })

  it('rejects when the worker reports an error', async () => {
    const w = fakeWorker((m) => ({ id: m.id, error: 'Failed to fetch' }))
    const client = createBaselineClient({ createWorker: () => w })
    await expect(client.lookup('cell', 'TP53')).rejects.toThrow('Failed to fetch')
    expect(client.isLoaded('cell')).toBe(false)
  })

  it('falls back to loading in-thread when no worker is available', async () => {
    const client = createBaselineClient({ base: '/b/', createWorker: () => null })
    await expect(client.lookup('tissue', 'tp53')).resolves.toMatchObject({ name: 'P04637' })
    expect(loadGzipJson).toHaveBeenCalledWith('/b/data/tissueJson.json.gz')
    expect(client.isLoaded('tissue')).toBe(true)
  })

  it('switches to in-thread loading if the worker crashes', async () => {
    const w = { postMessage: vi.fn(), terminate: vi.fn() }
    const client = createBaselineClient({ createWorker: () => w })
    const p = client.lookup('tissue', 'TP53')
    w.onerror({ message: 'boom' })
    await expect(p).rejects.toThrow('boom')
    await expect(client.lookup('tissue', 'TP53')).resolves.toMatchObject({ name: 'P04637' })
  })
})
