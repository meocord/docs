import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Div } from '@meonode/ui'
import { lowerMarkdown, type LowerOptions } from '@/lib/prose/lower'

const html = (markdown: string, options?: LowerOptions) =>
  renderToStaticMarkup(Div({ children: lowerMarkdown(markdown, options).nodes }).render())

describe('lowerMarkdown', () => {
  it('gives headings the anchors GitHub gives them, and lists them', () => {
    const { headings } = lowerMarkdown('## Running `bun test`\n\n### Why?\n\n## Running `bun test`')
    expect(headings).toEqual([
      { id: 'running-bun-test', title: 'Running bun test', depth: 2 },
      { id: 'why', title: 'Why?', depth: 3 },
      { id: 'running-bun-test-1', title: 'Running bun test', depth: 2 },
    ])
    expect(html('## Running `bun test`')).toContain('<h2 id="running-bun-test">Running <code>bun test</code></h2>')
  })

  it('draws plain elements, with no class of their own', () => {
    const out = html('A **bold** _word_ and ~~gone~~.\n\n> quoted\n\n---')
    expect(out).toContain('<p>A <strong>bold</strong> <em>word</em> and <del>gone</del>.</p>')
    expect(out).toContain('<blockquote><p>quoted</p></blockquote>')
    expect(out).toContain('<hr/>')
    expect(out).not.toContain('class=')
  })

  it('passes links through the href option', () => {
    expect(html('[Guards](/docs/4.0/guards)', { href: url => url.replace('/4.0/', '/latest/') })).toContain(
      '<a href="/docs/latest/guards">Guards</a>',
    )
  })

  it('frames code with its language, as written', () => {
    const out = html('```text\nbun run test   # once\n```')
    expect(out).toContain('<figure data-code="true">')
    expect(out).toContain('<pre data-language="text"><code>bun run test   # once</code></pre>')
  })

  it('embeds an ::example through the resolver, named by its file', () => {
    const out = html('::example{file="guards/rate-limit.ts" region="guard"}', {
      example: (file, region) => `// ${file} ${region}`,
    })
    expect(out).toContain('<span data-file="true">guards/rate-limit.ts</span>')
    expect(out).toContain('<pre data-language="ts">')
    expect(out).toContain('// guards/rate-limit.ts guard')
  })

  it('turns a GitHub alert into a callout, and leaves other quotes alone', () => {
    const out = html('> [!WARNING]\n> Mind the gap.\n\n> Just a quote.')
    expect(out).toContain(
      '<aside role="note" data-callout="warning"><strong data-callout-label="true">Warning</strong><p>Mind the gap.</p></aside>',
    )
    expect(out).toContain('<blockquote><p>Just a quote.</p></blockquote>')
  })

  it('unwraps the paragraphs of a tight list, and keeps a loose one', () => {
    expect(html('- one\n- two')).toContain('<ul><li>one</li><li>two</li></ul>')
    expect(html('- one\n\n- two')).toContain('<li><p>one</p></li>')
    expect(html('3. three\n4. four')).toContain('<ol start="3">')
  })

  it('draws tables with their alignment, and drops raw HTML', () => {
    const out = html('| a | b |\n| :- | -: |\n| 1 | 2 |\n\n<div>raw</div>')
    expect(out).toContain('<th data-align="left">a</th><th data-align="right">b</th>')
    expect(out).toContain('<td data-align="left">1</td>')
    expect(out).not.toContain('raw')
  })
  it('draws breaks, images and an ::example without a resolver as nothing', () => {
    const out = html('one  \ntwo\n\n![a cat](/cat.png)\n\n::example{file="x.ts"}')
    expect(out).toContain('one<br/>two')
    expect(out).toContain('<img src="/cat.png" alt="a cat" loading="lazy"/>')
    expect(out).not.toContain('::example')
  })

  it('titles a heading from its text, images and breaks included', () => {
    expect(lowerMarkdown('## A ![b](/b.png) c').headings[0].title).toBe('A  c')
  })
})
