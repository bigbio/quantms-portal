// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Models, { filterModels, uniqueValues } from './Models.vue'

const catalogue = [
  { name: 'AlphaPeptDeep MS2', description: 'MS2 prediction', collection: 'msnet', tool: 'AlphaPeptDeep', format: 'pt', date: '2026-04-11', url: 'https://x' },
  { name: 'AutoRT', description: null, collection: 'msnet', tool: null, format: 'tar.gz', date: '2026-04-11', url: 'https://y' },
]

afterEach(() => vi.unstubAllGlobals())

describe('Models helpers', () => {
  it('filters without crashing on missing fields', () => {
    expect(filterModels(catalogue, { query: 'auto' }).map((m) => m.name)).toEqual(['AutoRT'])
    expect(filterModels(catalogue, { query: 'alphapept' })).toHaveLength(1)
    expect(filterModels(catalogue, { tool: 'AlphaPeptDeep' })).toHaveLength(1)
    expect(filterModels(catalogue, { collection: 'msnet' })).toHaveLength(2)
  })

  it('lists distinct non-empty values', () => {
    expect(uniqueValues(catalogue, 'tool')).toEqual(['AlphaPeptDeep'])
    expect(uniqueValues(catalogue, 'collection')).toEqual(['msnet'])
  })
})

describe('Models view', () => {
  it('shows a retryable error instead of "no models" when the catalogue fails to load', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('nope', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(catalogue), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const w = mount(Models)
    await flushPromises()
    expect(w.text()).toContain('could not be loaded')
    expect(w.text()).not.toContain('No models found')

    await w.findAll('button').find((b) => b.text() === 'Retry').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('could not be loaded')
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })

  it('suggests adjusting filters only when models exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(catalogue), { status: 200 })))
    const w = mount(Models)
    await flushPromises()
    await w.find('input[aria-label="Search models"]').setValue('zzz')
    expect(w.text()).toContain('No models found')
    expect(w.text()).toContain('Try adjusting your filters')
  })
})
