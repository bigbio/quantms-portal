import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseIndex, listModelFiles, describeModels } from './models.js'

const row = (name, modified, size) =>
  `<tr><td valign="top"><img src="/icons/blank.gif" alt="[   ]"></td><td><a href="${name}">${name}</a></td><td align="right">${modified}  </td><td align="right">${size}</td><td>&nbsp;</td></tr>`
const index = (...rows) =>
  `<table><tr><th><a href="?C=N;O=D">Name</a></th></tr><tr><td><a href="/pub/up/">Parent Directory</a></td><td>&nbsp;</td><td align="right">  - </td></tr>${rows.join('\n')}</table>`

const ROOT = 'https://ftp.example/models/'
const PAGES = {
  [ROOT]: index(row('msnet/', '2026-04-11 11:30', '-')),
  [`${ROOT}msnet/`]: index(row('autort/', '2026-04-11 11:34', '-'), row('newtool/', '2026-10-01 09:00', '-')),
  [`${ROOT}msnet/autort/`]: index(row('AutoRT.tar.gz', '2026-04-11 11:34', '176M')),
  [`${ROOT}msnet/newtool/`]: index(row('model.ckpt', '2026-10-01 09:00', '1.2G')),
}

afterEach(() => vi.unstubAllGlobals())

describe('model catalogue', () => {
  it('reads files and folders from an Apache index, skipping sort and parent links', () => {
    expect(parseIndex(PAGES[`${ROOT}msnet/autort/`])).toEqual([{ name: 'AutoRT.tar.gz', modified: '2026-04-11 11:34', size: '176M' }])
  })

  it('walks sub-folders and describes listed files from the snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => new Response(PAGES[url], { status: PAGES[url] ? 200 : 404 })))
    const files = await listModelFiles(ROOT)
    const snapshot = [{ url: `${ROOT}msnet/autort/AutoRT.tar.gz`, name: 'AutoRT Retention Time Model', tool: 'AutoRT', format: 'Archive (.tar.gz)', description: 'RT' }]
    const rows = describeModels(files, ROOT, snapshot)
    expect(rows).toEqual([
      { name: 'AutoRT Retention Time Model', description: 'RT', collection: 'msnet', tool: 'AutoRT', format: 'Archive (.tar.gz)', size: '176 MB', file: 'AutoRT.tar.gz', url: `${ROOT}msnet/autort/AutoRT.tar.gz`, date: '2026-04-11' },
      { name: 'model.ckpt', description: '', collection: 'msnet', tool: 'newtool', format: '.ckpt', size: '1.2 GB', file: 'model.ckpt', url: `${ROOT}msnet/newtool/model.ckpt`, date: '2026-10-01' },
    ])
  })
})
