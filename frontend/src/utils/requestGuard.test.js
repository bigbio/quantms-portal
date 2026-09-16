import { describe, it, expect } from 'vitest'
import { createRequestGuard } from './requestGuard.js'

describe('createRequestGuard', () => {
  it('only the latest request is current', () => {
    const g = createRequestGuard()
    const a = g.next()
    expect(a()).toBe(true)
    const b = g.next()
    expect(a()).toBe(false)
    expect(b()).toBe(true)
  })

  it('invalidate() retires every started request', () => {
    const g = createRequestGuard()
    const a = g.next()
    g.invalidate()
    expect(a()).toBe(false)
  })

  it('guards are independent of each other', () => {
    const g1 = createRequestGuard()
    const g2 = createRequestGuard()
    const a = g1.next()
    g2.next()
    expect(a()).toBe(true)
  })
})
