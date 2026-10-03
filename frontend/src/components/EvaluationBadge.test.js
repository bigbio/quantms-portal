// frontend/src/components/EvaluationBadge.test.js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EvaluationBadge from './EvaluationBadge.vue'

const rec = { verdict: 'FAIL', dimensions: { ms: 'FAIL', biology: 'PASS', metadata: 'NA' }, override: null,
  evaluator_version: '1.0.0', checks: [{ id: 'ms.run_integrity', status: 'FAIL', value: 0, threshold: '>= 0.9', reason: '0% runs' }] }

describe('EvaluationBadge', () => {
  it('renders one chip per dimension with its status', () => {
    const w = mount(EvaluationBadge, { props: { record: rec } })
    const chips = w.findAll('.eval-chip').map((c) => c.text())
    expect(chips).toEqual(['MS FAIL', 'Biology PASS', 'Metadata NA'])
    expect(w.find('.chip-FAIL').exists()).toBe(true)
  })
  it('lists failing checks and shows override reason', () => {
    const w = mount(EvaluationBadge, { props: { record: { ...rec, override: { override_reason: 'curated' } } } })
    expect(w.text()).toContain('ms.run_integrity')
    expect(w.text()).toContain('curated')
  })
  it('renders an ERROR record honestly and tolerates missing checks', () => {
    const w = mount(EvaluationBadge, { props: { record: { verdict: 'ERROR', dimensions: { ms: 'NA', biology: 'NA', metadata: 'NA' }, override: null } } })
    expect(w.text()).toContain('ERROR')
    expect(w.findAll('.eval-chip').map((c) => c.text())).toEqual(['Evaluation ERROR', 'MS NA', 'Biology NA', 'Metadata NA'])
  })
  it('renders nothing without a record', () => {
    expect(mount(EvaluationBadge, { props: { record: null } }).html()).toBe('<!--v-if-->')
  })
})
