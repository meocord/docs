import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Div, Figure } from '@meonode/ui'
import { lowerMarkdown, type LowerOptions, type PlaygroundDirective } from '@/lib/prose/lower'

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
    expect(out).toContain('<pre tabindex="0" data-language="text"><code>bun run test   # once</code></pre>')
  })

  it('embeds an ::example through the resolver, named by its file', () => {
    const out = html('::example{file="guards/rate-limit.ts" region="guard"}', {
      example: (file, region) => `// ${file} ${region}`,
    })
    expect(out).toContain('<span data-file="true">guards/rate-limit.ts</span>')
    expect(out).toContain('<pre tabindex="0" data-language="ts">')
    expect(out).toContain('// guards/rate-limit.ts guard')
  })

  it('passes an ::example’s from to the resolver', () => {
    const out = html('::example{from="compare" file="discordjs/bot.ts" region="client"}', {
      example: (file, region, from) => `// ${from} ${file} ${region}`,
    })
    expect(out).toContain('// compare discordjs/bot.ts client')
  })

  it('hands a ::playground to its resolver, and draws it as its ::example when there is none or it declines', () => {
    const seen: unknown[] = []
    const playground = (directive: PlaygroundDirective, key: number) => {
      seen.push(directive)
      return directive.file === 'live.ts' ? Div({ key, 'data-playground': true }) : undefined
    }
    const example = (file: string, region?: string) => `// ${file} ${region ?? 'whole'}`
    expect(
      html('::playground{file="live.ts" region="count" dispatch="button counter/1"}', { playground, example }),
    ).toBe('<div><div data-playground="true"></div></div>')
    expect(seen).toEqual([{ file: 'live.ts', region: 'count', dispatch: 'button counter/1' }])
    const asked: unknown[] = []
    html('::playground{file="other.ts" from="compare" dispatch="/ping"}', {
      example: (...args: unknown[]) => {
        asked.push(args)
        return ''
      },
    })
    // Only the file and region reach the example's resolver
    expect(asked).toEqual([['other.ts', undefined, undefined]])
    for (const options of [{ playground, example }, { example }]) {
      const out = html('::playground{file="other.ts" region="count" dispatch="/ping"}', options)
      expect(out).toContain('<figure data-code="true">')
      expect(out).toContain('other.ts count')
    }
  })

  it('draws a ::figure the page names, and nothing for one it has none of', () => {
    const figure = (name: string, key: number) =>
      name === 'pipeline' ? Figure({ key, 'data-pipeline-figure': true }) : undefined
    expect(html('::figure{name="pipeline"}', { figure })).toBe(
      '<div><figure data-pipeline-figure="true"></figure></div>',
    )
    expect(html('::figure{name="map"}\n\nAfter.', { figure })).toBe('<div><p>After.</p></div>')
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

  it("drops a README's row of badges from another site, which the page's policy can't load", () => {
    const badges = [
      '[![npm version](https://img.shields.io/npm/v/meocord.svg)](https://www.npmjs.com/package/meocord)',
      '[![CI](https://github.com/meocord/meocord/actions/workflows/release.yml/badge.svg)](https://github.com/meocord/meocord/actions)',
      '![node](https://img.shields.io/node/v/meocord)',
    ].join('\n')
    const out = html(`Before.\n\n${badges}\n\nAfter.`)
    expect(out).toBe('<div><p>Before.</p><p>After.</p></div>')
    // A row of the site's own images stays
    expect(html('[![a](/a.svg)](/a) ![b](data:image/png;base64,AA==)')).toContain('<img src="/a.svg"')
  })

  it('draws an image from another site as its alt text, linked to it, and never loads it', () => {
    expect(html('See ![the diagram](https://example.test/d.png) here.')).toBe(
      '<div><p>See <a href="https://example.test/d.png">the diagram</a> here.</p></div>',
    )
    // Inside a link, the alt text alone, so no link sits within a link
    expect(html('[Docs ![logo](https://example.test/l.png)](/docs)')).toBe(
      '<div><p><a href="/docs">Docs logo</a></p></div>',
    )
    // A source that isn't the web is text only, never a link to follow
    expect(html('Look: ![x](javascript:void) and ![](//cdn.test/y.png).')).toBe(
      '<div><p>Look: x and //cdn.test/y.png.</p></div>',
    )
    expect(html('![logo](/logo.svg) ![dot](data:image/png;base64,AA==)')).toBe(
      '<div><p><img src="/logo.svg" alt="logo" loading="lazy"/> <img src="data:image/png;base64,AA==" alt="dot" loading="lazy"/></p></div>',
    )
  })

  it('marks each term on a page that defines terms with its anchor, and no other paragraph', () => {
    const markdown = '**Cooldown store.** Where counts are kept.\n\nA plain paragraph.'
    expect(html(markdown, { terms: true })).toBe(
      '<div><p id="cooldown-store" data-term="true"><strong>Cooldown store.</strong> Where counts are kept.</p>' +
        '<p>A plain paragraph.</p></div>',
    )
    expect(html(markdown)).not.toContain('id=')
  })

  it('titles a heading from its text, images and breaks included', () => {
    expect(lowerMarkdown('## A ![b](/b.png) c').headings[0].title).toBe('A  c')
  })
})
