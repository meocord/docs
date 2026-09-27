import { describe, expect, it } from 'vitest'
import { pageAnchors } from '../../scripts/lib/content'
import { listPages, loadPage } from '../../scripts/lib/pages'
import { README_SECTIONS } from '@/config/readme-sections'

describe('README_SECTIONS', () => {
  it("lands every section on a page of its line, at one of that page's headings", () => {
    const misplaced = Object.entries(README_SECTIONS).flatMap(([line, sections]) =>
      Object.entries(sections).flatMap(([section, target]) => {
        const { slug, anchor } = typeof target === 'string' ? { slug: target, anchor: section } : target
        const page = listPages(line).some(entry => entry.slug === slug) ? loadPage(line, slug) : undefined
        if (!page) return [`${line} ${section}: no page ${slug}`]
        return anchor && !pageAnchors(page.body).has(anchor) ? [`${line} ${section}: ${slug} has no #${anchor}`] : []
      }),
    )
    expect(misplaced).toEqual([])
  })
})
