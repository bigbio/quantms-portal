// Downloads for the Explorer's charts: the chart as a PNG (from its canvas, or
// its SVG with the page's styles written inline) and the data behind it as CSV.

export function toCsv(columns, rows) {
  const cell = (v) => {
    if (v == null) return ''
    const s = Array.isArray(v) ? v.join(';') : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns, ...rows.map((r) => (Array.isArray(r) ? r : columns.map((c) => r[c])))]
  return `${lines.map((r) => r.map(cell).join(',')).join('\n')}\n`
}

function save(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function downloadCsv(columns, rows, name) {
  save(new Blob([toCsv(columns, rows)], { type: 'text/csv' }), `${name}.csv`)
}

const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity',
  'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline']

async function svgImage(svg) {
  const { width, height } = svg.getBoundingClientRect()
  const clone = svg.cloneNode(true)
  const from = [svg, ...svg.querySelectorAll('*')]
  const to = [clone, ...clone.querySelectorAll('*')]
  from.forEach((el, i) => {
    const cs = getComputedStyle(el)
    to[i].setAttribute('style', STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'))
  })
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', width)
  clone.setAttribute('height', height)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
  await img.decode()
  return { img, width, height }
}

// Saves the canvas or SVG in `el` as `name`.png, at twice its size on the chart background.
export async function downloadPng(el, name) {
  const target = el.matches('canvas, svg') ? el : el.querySelector('canvas, svg')
  const { img, width, height } = target.tagName.toLowerCase() === 'svg'
    ? await svgImage(target)
    : { img: target, width: target.clientWidth, height: target.clientHeight }
  const out = document.createElement('canvas')
  out.width = Math.round(width * 2)
  out.height = Math.round(height * 2)
  const ctx = out.getContext('2d')
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(img, 0, 0, out.width, out.height)
  out.toBlob((blob) => save(blob, `${name}.png`), 'image/png')
}

// The table behind a Chart.js chart: a row per label, a column per dataset.
export function chartTable(data, first = 'label') {
  const sets = data.datasets
  const columns = [first, ...sets.map((d, i) => d.label || (sets.length > 1 ? `series_${i + 1}` : 'value'))]
  return { columns, rows: data.labels.map((l, i) => [l, ...sets.map((d) => d.data[i])]) }
}
