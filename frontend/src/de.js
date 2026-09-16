import { apiGet, encodePath } from './api.js'
import { DE_BASE } from './config.js'
export const listDatasets = () => apiGet(DE_BASE, '/de/datasets')
export const getDesign = (ref) => apiGet(DE_BASE, `/de/${encodePath(ref)}/design`)
export const getDefault = (ref, contrast) => apiGet(DE_BASE, `/de/${encodePath(ref)}/default`, { contrast })
export const getQc = (ref) => apiGet(DE_BASE, `/de/${encodePath(ref)}/qc`)
