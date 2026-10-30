// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import CollectionsTable from './CollectionsTable.vue'

describe('CollectionsTable', () => {
  it('links each collection to its page', () => {
    const w = mount(CollectionsTable, {
      props: { collections: [{ name: 'msnet', title: 'MS-Net Peptide Identifications', type: 'identification', dataset_count: 117 }] },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    const link = w.findComponent(RouterLinkStub)
    expect(link.props('to')).toBe('/collections/msnet')
    expect(link.text()).toBe('MS-Net Peptide Identifications')
    expect(w.find('td.num').text()).toBe('117')
  })
})
