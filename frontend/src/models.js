// Model catalogue: the files in the PRIDE FTP models folder, listed live, with
// names and descriptions from the curated snapshot (public/data/models.json)
// for the files it covers.

const UNITS = { K: 'KB', M: 'MB', G: 'GB', T: 'TB' }

// Entries of an Apache directory index: { name, modified, size }; folders end in "/".
export function parseIndex(html) {
  const re = /<a href="([^"?/][^"]*)">[^<]*<\/a><\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td>/g
  return [...html.matchAll(re)].map((m) => ({ name: m[1], modified: m[2].trim(), size: m[3].trim() }))
}

// Every file below `url`, walking sub-folders.
export async function listModelFiles(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const entries = parseIndex(await res.text())
  const nested = await Promise.all(entries.map(async (e) => {
    if (e.name.endsWith('/')) return listModelFiles(url + e.name)
    const size = e.size.replace(/^([\d.]+)([KMGT])$/, (_, n, u) => `${n} ${UNITS[u]}`)
    return [{ url: url + e.name, file: e.name, date: e.modified.slice(0, 10), size }]
  }))
  return nested.flat()
}

// Catalogue rows for the listed files. Folders below the root are
// <collection>/<tool>/; a file the snapshot does not describe shows its file name.
export function describeModels(files, root, snapshot) {
  const byUrl = new Map(snapshot.map((m) => [m.url, m]))
  return files.map((f) => {
    const d = byUrl.get(f.url) || {}
    const [collection = '', tool = ''] = f.url.slice(root.length).split('/').slice(0, -1)
    return {
      name: d.name || f.file,
      description: d.description || '',
      collection: d.collection || collection,
      tool: d.tool || tool,
      format: d.format || f.file.slice(f.file.indexOf('.')),
      size: f.size,
      file: f.file,
      url: f.url,
      date: f.date,
    }
  })
}
