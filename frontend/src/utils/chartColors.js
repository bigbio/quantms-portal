// Colours for charts and category tags, read from the CSS tokens in style.css
// (the fallbacks repeat them for environments without the stylesheet, e.g. tests).

// The --cat-1..8 palette, in its checked order.
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

const TOKENS = {
  data: ['--data', CATEGORICAL[0]],
  other: ['--data-other', '#a3acb6'],
  pooled: ['--data-pooled', '#0b3a6a'],
  disease: ['--dim-disease', CATEGORICAL[1]],
  tissue: ['--dim-tissue', CATEGORICAL[2]],
  instrument: ['--dim-instrument', CATEGORICAL[3]],
  cellLine: ['--dim-cell-line', CATEGORICAL[4]],
  organism: ['--dim-organism', CATEGORICAL[6]],
}

export function chartColor(role) {
  const [name, fallback] = TOKENS[role]
  const v = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name) : ''
  return (v && v.trim()) || fallback
}

// Palette slot (1-8) for an open-ended category such as a collection name.
// Names listed in `fixed` keep their slot; any other name takes one of the
// remaining slots, picked by a hash of the name so it keeps the same colour
// however many categories exist (colour follows the category, not its rank).
export function categorySlot(name, fixed = {}) {
  if (fixed[name]) return fixed[name]
  const taken = new Set(Object.values(fixed))
  const free = CATEGORICAL.map((_, i) => i + 1).filter((i) => !taken.has(i))
  const pool = free.length ? free : CATEGORICAL.map((_, i) => i + 1)
  let h = 0
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return pool[h % pool.length]
}

// --- lighter and darker steps, in OKLab so equal steps look equal --------------

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function oklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

function linearRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
}

// The colour at lightness L with the hue of (a, b), losing chroma until it fits sRGB.
function atLightness(hex, L) {
  const [, a, b] = oklab(hex)
  for (let k = 1; k > 0; k -= 0.05) {
    const rgb = linearRgb([L, a * k, b * k])
    if (rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4)) {
      return `#${rgb.map((c) => Math.round(toGamma(Math.min(1, Math.max(0, c))) * 255).toString(16).padStart(2, '0')).join('')}`
    }
  }
  return hex
}

// `n` distinguishable members of one colour family: the colour itself first, then
// alternately darker and lighter steps.
export function shades(hex, n) {
  const L = oklab(hex)[0]
  const step = Math.min(0.09, 0.3 / Math.max(1, Math.ceil((n - 1) / 2)))
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return hex
    const k = Math.ceil(i / 2) * (i % 2 ? -1 : 1)
    return atLightness(hex, Math.min(0.9, Math.max(0.3, L + k * step)))
  })
}

// `n` steps of one hue from light to dark, for an ordered annotation.
export function ramp(n, hex = CATEGORICAL[0]) {
  if (n === 1) return [hex]
  return Array.from({ length: n }, (_, i) => atLightness(hex, 0.84 - (0.46 * i) / (n - 1)))
}
