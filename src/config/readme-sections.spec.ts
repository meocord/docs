import { describe, expect, it } from 'vitest'
import { pageAnchors } from '../../scripts/lib/content'
import { readGuide } from '../../scripts/lib/guide'
import { README_SECTIONS } from '@/config/readme-sections'

describe('README_SECTIONS', () => {
  it("lands every section on a Guide page of its line, at one of that page's headings", () => {
    const misplaced = Object.entries(README_SECTIONS).flatMap(([line, sections]) =>
      Object.entries(sections).flatMap(([section, target]) => {
        const { slug, group, anchor } =
          typeof target === 'string' ? { slug: target, group: undefined, anchor: section } : target
        const page = readGuide(line).find(
          entry => entry.page.id === slug && entry.page.group === (group ?? entry.page.group),
        )
        if (!page) return [`${line} ${section}: no page ${group ? `${group}/` : ''}${slug}`]
        return anchor && !pageAnchors(page.body).has(anchor) ? [`${line} ${section}: ${slug} has no #${anchor}`] : []
      }),
    )
    expect(misplaced).toEqual([])
  })
})
