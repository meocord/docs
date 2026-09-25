import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { modelLayouts } from '../../../scripts/lib/api-layout'
import { apiArticle, apiSidebar } from '@/lib/docs/api-render'
import { apiModel } from '@/lib/docs/api-site'
import { CODE_PALETTES } from '@/lib/prose/highlight'

const model = apiModel('4.1')!

describe('apiArticle', () => {
  it('lists the sections and members in the table of contents, at their anchors', () => {
    const { toc } = apiArticle(model.symbol('core', 'ShardContext')!)
    expect(toc.filter(entry => entry.depth === 2).map(entry => entry.id)).toEqual(['examples', 'members'])
    const members = toc.filter(entry => entry.depth === 3)
    expect(members.length).toBeGreaterThan(0)
    expect(members.every(entry => entry.id === entry.title.toLowerCase())).toBe(true)
  })

  it('gives a function its parameters, returns and examples', () => {
    const { toc } = apiArticle(model.symbol('decorator', 'Cooldown')!)
    expect(toc.map(entry => entry.id)).toEqual(['parameters', 'returns', 'examples'])
  })

  it('keeps a section anchor clear of a member with the same name', () => {
    const symbol = { ...model.symbol('core', 'ShardContext')! }
    symbol.members = [{ ...symbol.members[0], name: 'members', anchor: 'members' }]
    const ids = apiArticle(symbol).toc.map(entry => entry.id)
    expect(ids).toContain('members-section')
    expect(ids).toContain('members')
  })
})

describe('apiArticle code', async () => {
  const layouts = await modelLayouts(model)
  const html = (entry: string, name: string, withLayouts = layouts) =>
    renderToStaticMarkup(Div({ children: apiArticle(model.symbol(entry, name)!, withLayouts).nodes }).render())
  const blocks = (markup: string) =>
    [...markup.matchAll(/<pre data-signature="true"[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)].map(match =>
      match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'),
    )

  it("shows @Command's declaration and returned decorator as formatted TypeScript", () => {
    const [declaration, returns] = blocks(html('decorator', 'Command'))
    expect(declaration.split('\n').length).toBeGreaterThan(10)
    expect(declaration).toMatch(/^Command<\n {2}CBC extends BuildableCommandType,/)
    expect(returns.split('\n').length).toBeGreaterThan(10)
    expect(returns.endsWith(') => void')).toBe(true)
  })

  it('keeps the links in formatted code, and highlights it as a guide highlights code', () => {
    const markup = html('decorator', 'Command')
    const href = model.href({ entry: 'meocord/enum', symbol: 'CommandType' })
    expect(markup).toContain(`<a href="${href}"><span style="--code-dark:`)
    expect(markup).toMatch(/<span style="--code-dark:#[0-9A-F]{6};--code-light:#[0-9A-F]{6}">Command<\/span>/)
  })

  it("colours a member as a class body holds it, a constructor's new as a keyword", () => {
    const colour = (name: 'keyword' | 'func') =>
      `<span style="--code-dark:${CODE_PALETTES.dark[name]};--code-light:${CODE_PALETTES.light[name]}">`
    expect(html('testing', 'TestingModule')).toContain(
      `${colour('keyword')}new </span>${colour('func')}TestingModule</span>`,
    )
  })

  it('draws markup in a type as text, and escapes its links', () => {
    const symbol = model.symbol('decorator', 'Command')!
    const hostile = {
      ...symbol,
      code: [
        [
          { text: "Record<'<b>', string> | '</code><script>alert(1)</script>' | " },
          { text: 'Target', href: '/docs/"><img src=x onerror=alert(1)>' },
        ],
      ],
    }
    const markup = renderToStaticMarkup(Div({ children: apiArticle(hostile, layouts).nodes }).render())
    expect(markup).not.toContain('<script>')
    expect(markup).not.toContain('<b>')
    expect(markup).not.toContain('<img')
    expect(markup).toContain('<a href="/docs/&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">')
    expect(blocks(markup)[0]).toBe(hostile.code[0].map(token => token.text).join(''))
  })

  it('says what a decorator factory returns before its full type', () => {
    expect(html('decorator', 'Command')).toContain('<p>Returns a method decorator.</p>')
    expect(html('decorator', 'Controller')).toContain('<p>Returns a class decorator.</p>')
    expect(html('decorator', 'Cooldown')).toContain('<p>Returns a decorator for a class or a method.</p>')
    expect(html('decorator', 'UseGuard')).not.toContain('decorator.</p>')
    expect(html('common', 'createMetadata')).not.toContain('decorator.</p>')
  })

  it("lays a long parameter type out in its cell, as @UseGuard's", () => {
    const markup = html('decorator', 'UseGuard')
    const cell = /<code data-type="true">([\s\S]*?)<\/code>/.exec(markup)![1].replace(/<[^>]+>/g, '')
    expect(cell).toBe(['(', '  | ((...args: any[]) =&gt; GuardInterface)', '  | GuardWithParams', ')[]'].join('\n'))
  })

  it('keeps short code, and all code without layouts, on one line', () => {
    expect(blocks(html('common', 'createMetadata'))[0]).toBe(
      'createMetadata<T>(description?: string): MetadataDecorator<T>',
    )
    expect(blocks(html('decorator', 'Command', {})).every(block => !block.includes('\n'))).toBe(true)
  })

  it('leaves a blank line between overloads once any runs over lines', () => {
    const symbol = model.symbol('decorator', 'Command')!
    const twice = { ...symbol, code: [symbol.code[0], symbol.code[0]] }
    const markup = renderToStaticMarkup(Div({ children: apiArticle(twice, layouts).nodes }).render())
    expect(blocks(markup)[0]).toContain(') => void\n\nCommand<')
  })
})

describe('apiSidebar', () => {
  it('follows the guides with one group per entry point, marking the current symbol', () => {
    const current = model.href({ entry: 'meocord/decorator', symbol: 'Cooldown' })
    const groups = apiSidebar('4.1', model, current)
    const decorator = groups.find(group => group.title === 'meocord/decorator')!
    expect(decorator.items.find(item => item.current)?.title).toBe('Cooldown')
    expect(groups.findIndex(group => group.title.startsWith('meocord/'))).toBeGreaterThan(0)
  })
})
