import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { markSvgNode } from '@/components/home/mark-node'

describe('markSvgNode', () => {
  it('draws the mark as plain SVG, sized by attributes and with no class', () => {
    const html = renderToStaticMarkup(markSvgNode(18).render())
    const tag = /<svg[^>]*>/.exec(html)?.[0] ?? ''
    expect(tag).toContain(' width="18"')
    expect(tag).toContain(' height="18"')
    expect(tag).not.toContain(' class=')
    expect(html).not.toContain('<style')
  })
})
