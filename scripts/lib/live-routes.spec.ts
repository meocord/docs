import { describe, expect, it } from 'vitest'
import { unmappedPages, type LiveRoutes } from './live-routes'

describe('unmappedPages', () => {
  const routes: LiveRoutes = {
    commit: 'abc',
    paths: [],
    redirects: [],
    pages: [
      { line: '4.1', slug: 'guards', id: 'guards' },
      { line: '4.1', slug: 'quick-start', id: 'quick-start' },
      { line: '4.1', slug: 'responses', id: 'interaction-responses' },
      { line: '4.1', slug: 'tutorial', id: 'tutorial' },
      { line: '4.0', slug: 'anything', id: 'anything' },
    ],
  }
  const guide = [
    { path: 'guards', id: 'guards', formerly: [] },
    { path: 'first-command', id: 'first-command', formerly: ['quick-start'] },
    { path: 'responses', id: 'responses', formerly: [] },
  ]

  it('names each deployed page whose id or slug no Guide page takes, in the lines with a Guide only', () => {
    expect(unmappedPages(routes, { '4.1': guide })).toEqual([
      'content/4.1: the deployed page /docs/4.1/responses has no Guide page for its id "interaction-responses"',
      'content/4.1: the deployed page /docs/4.1/tutorial has no Guide page for its id "tutorial" or slug "tutorial"',
    ])
  })
  it('takes over a page by an id a Guide page covers, and never by an old slug that is a path the Guide takes', () => {
    const covering = [
      ...guide.slice(0, 2),
      { path: 'responses', id: 'responses', formerly: [], covers: ['4.1/interaction-responses'] },
    ]
    expect(unmappedPages(routes, { '4.1': covering })).toEqual([
      'content/4.1: the deployed page /docs/4.1/tutorial has no Guide page for its id "tutorial" or slug "tutorial"',
    ])
    // A formerly naming a path the Guide takes is refused by checkGuide, and takes nothing over here either
    const claiming = [...covering, { path: 'faq', id: 'faq', formerly: ['tutorial'] }]
    expect(unmappedPages(routes, { '4.1': claiming }, new Set(['tutorial']))).toEqual([
      'content/4.1: the deployed page /docs/4.1/tutorial has no Guide page for its slug "tutorial"',
    ])
  })
})
