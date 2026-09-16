// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import CollectionCard from './CollectionCard.vue'

describe('CollectionCard', () => {
  it('is a real link to the collection page (keyboard and middle-click friendly)', () => {
    const w = mount(CollectionCard, {
      props: { collection: { name: 'absolute-expression', title: 'Absolute Expression', dataset_count: 3, organisms: [] } },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    const link = w.findComponent(RouterLinkStub)
    expect(link.exists()).toBe(true)
    expect(link.props('to')).toBe('/collections/absolute-expression')
    expect(link.classes()).toContain('collection-card')
    expect(w.text()).toContain('Absolute Expression')
  })
})
