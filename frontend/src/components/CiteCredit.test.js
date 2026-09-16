// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../citation.js', () => ({ getCredits: vi.fn() }))
import { getCredits } from '../citation.js'
import CiteCredit from './CiteCredit.vue'

const creditsFor = (acc) => ({
  credits: [{ ref: `${acc}/h`, accession: acc, title: `Title ${acc}` }],
  collection_citations: [],
  citations: { text: `Cite ${acc}` },
})

describe('CiteCredit', () => {
  it('shows credits for the latest refs even if an older request resolves last', async () => {
    let releaseOld
    getCredits.mockImplementation((refs) => refs[0] === 'OLD/h'
      ? new Promise((r) => { releaseOld = () => r(creditsFor('OLD')) })
      : Promise.resolve(creditsFor('NEW')))
    const w = mount(CiteCredit, { props: { refs: ['OLD/h'] } })
    await flushPromises()
    await w.setProps({ refs: ['NEW/h'] })
    await flushPromises()
    releaseOld()
    await flushPromises()
    expect(w.text()).toContain('Title NEW')
    expect(w.text()).not.toContain('Title OLD')
  })
})
