import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api.js', () => ({ apiGet: vi.fn() }))
import { apiGet } from '../api.js'
import { datasetPath, fetchEvaluation, _clearEvaluationCache } from './evaluation.js'

describe('datasetPath', () => {
  it('links to the exact version when a dataset_ref exists', () => {
    expect(datasetPath({ collection: 'msnet', accession: 'PXD9', dataset_ref: 'PXD9/abc' })).toBe('/collections/msnet/PXD9/abc')
  })
  it('falls back to the accession', () => {
    expect(datasetPath({ collection: 'msnet', accession: 'PXD9' })).toBe('/collections/msnet/PXD9')
  })
})

describe('fetchEvaluation', () => {
  beforeEach(() => { _clearEvaluationCache(); apiGet.mockReset() })
  it('fetches once per ref and caches', async () => {
    apiGet.mockResolvedValue({ verdict: 'WARN' })
    expect(await fetchEvaluation('PXD9/abc')).toEqual({ verdict: 'WARN' })
    await fetchEvaluation('PXD9/abc')
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet.mock.calls[0][1]).toBe('/quantms/evaluations/PXD9/abc/evaluation.json')
  })
  it('resolves null on 404 / failure', async () => {
    apiGet.mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }))
    expect(await fetchEvaluation('PXD9/zzz')).toBeNull()
    expect(await fetchEvaluation(null)).toBeNull()
  })
})
