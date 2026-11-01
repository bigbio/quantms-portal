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

// The view fetches the FTP models folder (live listing) and the snapshot JSON.
const FTP_ROOT = 'https://ftp.pride.ebi.ac.uk/pub/databases/pride/resources/proteomes/quantms-models/'
const ftpIndex = `<table><tr><td><a href="x.pt">x.pt</a></td><td align="right">2026-04-11 11:34  </td><td align="right">12M</td></tr></table>`
const respond = ({ ftp, snapshot }) => vi.fn(async (url) => {
  const body = url === FTP_ROOT ? ftp : String(url).endsWith('/data/models.json') ? snapshot : null
  return body == null ? new Response('nope', { status: 404 }) : new Response(body, { status: 200 })
})

describe('Models view', () => {
  it('shows a retryable error instead of "no models" when neither source loads', async () => {
    vi.stubGlobal('fetch', respond({}))
    const w = mount(Models)
    await flushPromises()
    expect(w.text()).toContain('could not be loaded')
    expect(w.text()).not.toContain('No models found')

    vi.stubGlobal('fetch', respond({ ftp: ftpIndex, snapshot: JSON.stringify(catalogue) }))
    await w.findAll('button').find((b) => b.text() === 'Retry').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('could not be loaded')
    expect(w.findAll('tbody tr')).toHaveLength(1)
    expect(w.find('tbody').text()).toContain('x.pt')
  })

  it('falls back to the snapshot, saying so, when the FTP listing fails', async () => {
    vi.stubGlobal('fetch', respond({ snapshot: JSON.stringify(catalogue) }))
    const w = mount(Models)
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.text()).toContain('showing the catalogue snapshot')
  })

  it('suggests adjusting filters only when models exist', async () => {
    vi.stubGlobal('fetch', respond({ snapshot: JSON.stringify(catalogue) }))
    const w = mount(Models)
    await flushPromises()
    await w.find('input[aria-label="Search models"]').setValue('zzz')
    expect(w.text()).toContain('No models found')
    expect(w.text()).toContain('Try adjusting your filters')
  })
})
