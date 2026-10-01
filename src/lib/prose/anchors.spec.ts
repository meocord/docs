import { describe, expect, it } from 'vitest'
import { pageAnchorSet } from '@/lib/prose/anchors'
import { lowerMarkdown } from '@/lib/prose/lower'
import { pageAnchors } from '../../../scripts/lib/content'
import { splitSections } from '../../../scripts/lib/search'

const anchors = (markdown: string, terms = false) => [...pageAnchorSet(markdown, { terms })]

describe('pageAnchorSet', () => {
  it('slugs a heading from its text as written, code spans included, as the site renders it', () => {
    const markdown = '## The `respond()` call\n\ntext\n\n### `@Guard` and roles\n\nTitle\n=====\n'
    expect(anchors(markdown)).toEqual(['the-respond-call', 'guard-and-roles', 'title'])
    expect(anchors(markdown)).toEqual(lowerMarkdown(markdown).headings.map(heading => heading.id))
    expect([...pageAnchors(markdown)]).toEqual(anchors(markdown))
  })

  it('names each term a page defines, only when it defines terms, in order with its headings', () => {
    const markdown = [
      '**Cooldown store.** Where counts are kept.',
      '**`customId` pattern.** The route a component takes.',
      '**`UserError`.** A refusal the user is shown.',
      '- **Listed.** An item, not a term.',
      '> **Quoted.** A quote, not a term.',
      '**Bold** with no full stop, not a term.',
      '## Cooldown store',
    ].join('\n\n')
    expect(anchors(markdown, true)).toEqual(['cooldown-store', 'customid-pattern', 'usererror', 'cooldown-store-1'])
    expect(anchors(markdown)).toEqual(['cooldown-store'])
  })

  it('agrees with the ids the site renders and the anchors search links to', () => {
    const markdown = '**Guard.** Decides whether a call runs.\n\n## Guard\n\nMore.'
    const rendered = lowerMarkdown(markdown, { terms: true })
    expect(rendered.headings.map(heading => heading.id)).toEqual(['guard-1'])
    expect(splitSections(markdown, undefined, { terms: true }).map(section => section.anchor)).toEqual([
      undefined,
      'guard-1',
    ])
    expect(anchors(markdown, true)).toEqual(['guard', 'guard-1'])
  })
})
