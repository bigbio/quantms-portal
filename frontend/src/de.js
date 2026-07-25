import { apiGet } from './api.js'
import { DE_BASE } from './config.js'
export const listDatasets = () => apiGet(DE_BASE, '/de/datasets')
export const getDesign = (ref) => apiGet(DE_BASE, `/de/${ref}/design`)
export const getDefault = (ref, contrast) => apiGet(DE_BASE, `/de/${ref}/default`, { contrast })
export const getQc = (ref) => apiGet(DE_BASE, `/de/${ref}/qc`)
export async function runDe(ref, cfg) {
  const res = await fetch(`${DE_BASE}/de/${ref}/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
  })
  if (!res.ok) { const e = new Error('run failed'); e.status = res.status; throw e }
  return res.json()
}
