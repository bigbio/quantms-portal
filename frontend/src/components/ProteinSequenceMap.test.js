// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../api.js', () => ({
  apiGet: vi.fn(async () => ({
    accession: 'P1',
    found: true,
    sequence: 'ACDEFGHIKLMNPQRSTVWY'.repeat(6), // 120 residues
    intensity: [],
    depth: [],
    ptms: [],
  })),
}))
import ProteinSequenceMap, { nextResiduePos } from './ProteinSequenceMap.vue'

describe('nextResiduePos', () => {
  const opts = { min: 1, max: 120, cols: 50, offset: 0 }
  it('moves by one residue or one row and clamps to the window', () => {
    expect(nextResiduePos(5, 'ArrowRight', opts)).toBe(6)
    expect(nextResiduePos(5, 'ArrowLeft', opts)).toBe(4)
    expect(nextResiduePos(5, 'ArrowDown', opts)).toBe(55)
    expect(nextResiduePos(55, 'ArrowUp', opts)).toBe(5)
    expect(nextResiduePos(1, 'ArrowLeft', opts)).toBe(1)
    expect(nextResiduePos(110, 'ArrowDown', opts)).toBe(120)
  })
  it('jumps to the start and end of the row', () => {
    expect(nextResiduePos(57, 'Home', opts)).toBe(51)
    expect(nextResiduePos(57, 'End', opts)).toBe(100)
    expect(nextResiduePos(105, 'End', opts)).toBe(120)
  })
  it('respects a window offset and ignores other keys', () => {
    expect(nextResiduePos(1005, 'Home', { min: 1001, max: 2000, cols: 50, offset: 1000 })).toBe(1001)
    expect(nextResiduePos(5, 'a', opts)).toBeNull()
  })
})

describe('ProteinSequenceMap keyboard access', () => {
  it('is a single Tab stop and moves focus with arrow keys', async () => {
    const w = mount(ProteinSequenceMap, { props: { accession: 'P1' }, attachTo: document.body })
    await flushPromises()
    const cells = w.findAll('.sm-cell')
    expect(cells.length).toBeGreaterThan(0)
    const tabbable = cells.filter((c) => c.attributes('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0].attributes('data-pos')).toBe('1')

    await tabbable[0].trigger('focus')
    await tabbable[0].trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    const nowTabbable = w.findAll('.sm-cell').filter((c) => c.attributes('tabindex') === '0')
    expect(nowTabbable.map((c) => c.attributes('data-pos'))).toEqual(['2'])
    expect(document.activeElement.getAttribute('data-pos')).toBe('2')
    w.unmount()
  })
})
