// Citation & credit (Phase 1): resolve dataset refs -> credit records + pre-rendered
// citations (data producers + quantms + portal) from the gateway /credits endpoint.
import { GATEWAY_BASE } from './config.js'

export async function getCredits(refs) {
  const list = (refs || []).filter(Boolean).join(',')
  if (!list) return { credits: [], tools: [], citations: {}, missing: [] }
  const res = await fetch(`${GATEWAY_BASE}/credits?refs=${encodeURIComponent(list)}`)
  if (!res.ok) throw new Error(`credits fetch failed (${res.status})`)
  return await res.json()
}
