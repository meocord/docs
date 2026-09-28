import { describe, expect, it } from 'vitest'
import { pageAnchors } from '../../scripts/lib/content'
import { lowerMarkdown } from '@/lib/prose/lower'
import { pageSlugger, SHELL_IDS } from '@/lib/page-ids'

describe("the window's own ids", () => {
  it('are never a heading anchor: a heading named like one takes the next, on the page and in the check alike', () => {
    expect(pageSlugger().slug('Content')).toBe('content-1')
    const markdown = '## Content\n\nText.\n\n## Search results\n'
    const ids = lowerMarkdown(markdown).headings.map(heading => heading.id)
    expect(ids).toEqual(['content-1', 'search-results-1'])
    expect([...pageAnchors(markdown)]).toEqual(ids)
    expect(ids).not.toContain(SHELL_IDS.main)
  })
})
