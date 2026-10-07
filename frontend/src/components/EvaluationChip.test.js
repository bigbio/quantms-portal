// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../utils/evaluation.js', () => ({
  fetchEvaluation: vi.fn((r) => Promise.resolve(r === 'PXD1/bad' ? { verdict: 'FAIL' } : null)),
}))
import EvaluationChip from './EvaluationChip.vue'

describe('EvaluationChip', () => {
  it('shows the verdict of the version', async () => {
    const w = mount(EvaluationChip, { props: { datasetRef: 'PXD1/bad' } })
    await flushPromises()
    expect(w.find('.chip-FAIL').text()).toBe('FAIL')
  })
  it('shows a dash when the version has no evaluation', async () => {
    const w = mount(EvaluationChip, { props: { datasetRef: 'PXD1/none' } })
    await flushPromises()
    expect(w.find('.eval-mini').exists()).toBe(false)
    expect(w.text()).toBe('—')
  })
})
