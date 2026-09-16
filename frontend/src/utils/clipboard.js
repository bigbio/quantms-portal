// Copy text to the clipboard. Uses the async Clipboard API when available and
// falls back to a hidden textarea + execCommand('copy') (older browsers,
// non-secure contexts, or when the permission is denied). Resolves to true on
// success, false otherwise; never throws.
export async function copyText(text) {
  if (!text) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-1000px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  const active = document.activeElement
  try {
    ta.select()
    return document.execCommand('copy') === true
  } catch {
    return false
  } finally {
    document.body.removeChild(ta)
    if (active && typeof active.focus === 'function') active.focus()
  }
}
