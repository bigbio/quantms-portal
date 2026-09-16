// Citation & credit (Phase 1): resolve dataset refs -> credit records + pre-rendered
// citations (data producers + quantms + portal) from the gateway /credits endpoint.
import { GATEWAY_BASE } from './config.js'
import { apiGet } from './api.js'

// Goes through apiGet for the shared timeout / retry / error handling.
export async function getCredits(refs) {
  const list = (refs || []).filter(Boolean).join(',')
  if (!list) return { credits: [], tools: [], citations: {}, missing: [] }
  return apiGet(GATEWAY_BASE, '/credits', { refs: list })
}
