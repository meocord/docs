import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { modelLayouts } from '../../../scripts/lib/api-layout'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import {
  apiArticle,
  apiCrumbs,
  apiIndexArticle,
  apiKindArticle,
  apiSidebar,
  renderApiIndex,
} from '@/lib/docs/api-render'
import { apiModel } from '@/lib/docs/api-site'
import { CODE_PALETTES } from '@/lib/prose/highlight'

// A fixed release, so the layouts are checked against signatures that do not change with each sync.
const model = apiModel('4.1', '4.1.0-beta.4')!

describe('apiArticle', () => {
  it('lists the sections and members in the table of contents, at their anchors', () => {
    const { toc } = apiArticle(model.symbol('core', 'ShardContext')!)
    expect(toc.filter(entry => entry.depth === 2).map(entry => entry.id)).toEqual(['examples', 'members'])
    const members = toc.filter(entry => entry.depth === 3)
    expect(members.length).toBeGreaterThan(0)
    expect(members.every(entry => entry.id === entry.title.toLowerCase())).toBe(true)
  })

  it('lists the Guide pages that teach it, after its reference, at an id of its own', () => {
    const symbol = model.symbol('decorator', 'Cooldown')!
    const guide = [{ title: 'Cooldowns', href: '/docs/4.1/cooldowns' }]
    const markup = renderToStaticMarkup(Div({ children: apiArticle(symbol, {}, guide).nodes }).render())
    expect(markup).toContain('<aside data-guide-api="true" aria-labelledby="in-the-guide">')
    expect(markup).toContain('<h2 id="in-the-guide">In the Guide</h2>')
    expect(markup).toContain('<a href="/docs/4.1/cooldowns">Cooldowns</a>')
    expect(renderToStaticMarkup(Div({ children: apiArticle(symbol).nodes }).render())).not.toContain('In the Guide')
  })

  it('gives a function its parameters, returns and examples', () => {
    const { toc } = apiArticle(model.symbol('decorator', 'Cooldown')!)
    // Its options under its parameters, from CooldownOptions
    expect(toc.map(entry => entry.id)).toEqual([
      'parameters',
      'by',
      'bypass',
      'per',
      'seconds',
      'uses',
      'returns',
      'examples',
    ])
  })

  it('keeps a section anchor clear of a member with the same name', () => {
    const symbol = { ...model.symbol('core', 'ShardContext')! }
    symbol.members = [{ ...symbol.members[0], name: 'members', anchor: 'members' }]
    symbol.anchors = ['members']
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
    const href = model.href({ section: 'enum', symbol: 'CommandType' })
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
  it('follows the guides with one group per entry point, marking the current symbol, and heads no category', () => {
    const current = model.href({ section: 'decorator', symbol: 'Cooldown' })
    const groups = apiSidebar('4.1', model, current)
    const decorator = groups.find(group => group.title === 'meocord/decorator')!
    expect(decorator.items.find(item => item.current)?.title).toBe('Cooldown')
    expect(groups.findIndex(group => group.title.startsWith('meocord/'))).toBeGreaterThan(0)
    // beta.6's symbols carry categories, but an entry point lists them in source order
    const beta6 = apiSidebar('4.1', apiModel('4.1', undefined, 'entry')!)
    expect(beta6.flatMap(group => group.items).some(item => item.category)).toBe(false)
  })
})

describe('the API by kind', () => {
  beforeAll(() => vi.stubEnv('DOCS_NEXT', '1'))
  afterAll(() => vi.unstubAllEnvs())
  const html = (nodes: ReturnType<typeof apiArticle>['nodes']) =>
    renderToStaticMarkup(Div({ children: nodes }).render())

  it('groups the sidebar by kind, heading each category once, before its first symbol', () => {
    const groups = apiSidebar('4.1', apiModel('4.1')!)
    expect(groups[0].title).toBe('Controllers')
    const decorators = groups.find(group => group.title === 'Decorators')!
    expect(decorators.items.find(item => item.title === 'Cooldown')?.category).toBe('Pipeline stages')
    const nav = renderToStaticMarkup(SidebarNav({ groups: [decorators] }).render())
    const headings = [...nav.matchAll(/<div data-nav-category="true" aria-hidden="true">([^<]+)<\/div>/g)].map(
      match => match[1],
    )
    expect(headings).toEqual([...new Set(decorators.items.map(item => item.category))])
    // Each category a list of its own, named by it for a screen reader, which the visible label is hidden from
    expect(nav).toMatch(/<ul aria-label="Pipeline stages"><li><a href="\/docs\/4\.1\/api\/decorators\/[A-Za-z]+"/)
    expect(nav).toContain('<a href="/docs/4.1/api/decorators/Cooldown"')
    expect(nav.match(/<ul aria-label="Pipeline stages">[\s\S]*?<\/ul>/)![0]).toContain('/decorators/Cooldown"')
  })

  it('shows every symbol with its summary on the index, and a kind by category on its page', () => {
    const model = apiModel('4.1')!
    const index = html(apiIndexArticle('4.1', model).nodes)
    expect(index).toContain(
      '<h2 id="decorators" data-kind-heading="true"><a href="/docs/4.1/api/decorators">Decorators</a></h2>',
    )
    expect(index).toContain('<a href="/docs/4.1/api/decorators/Cooldown"><code>Cooldown</code></a>')
    const kind = apiKindArticle(model, 'decorators')!
    expect(html(kind.nodes)).toContain('<h2 id="decorators-pipeline-stages">Pipeline stages</h2>')
    expect(kind.toc.map(entry => entry.title)).toContain('Pipeline stages')
    expect(apiKindArticle(model, 'nothing')).toBeUndefined()
    // The index and kinds exist only where the API is arranged by kind
    vi.stubEnv('DOCS_NEXT', '')
    expect(renderApiIndex('4.1')).toBeUndefined()
    vi.stubEnv('DOCS_NEXT', '1')
  })

  it("gives each option its row's anchor, and lists the options in the contents", () => {
    const meocord = apiModel('4.1')!.symbol('decorators', 'MeoCord')!
    const { nodes, toc } = apiArticle(meocord)
    expect(html(nodes)).toContain('<tr id="i18n">')
    expect(toc.filter(entry => entry.depth === 3).map(entry => entry.id)).toEqual(
      expect.arrayContaining(['i18n', 'theme', 'cooldownstore', 'cooldownstorefailure']),
    )
  })

  it("names every entry point a symbol can be imported from, and trails to its kind's page", () => {
    const model = apiModel('4.1')!
    const app = model.symbol('controllers', 'MeoCordApplication')!
    expect(html(apiArticle(app).nodes)).toContain('<code>meocord/core</code> and <code>meocord/interface</code>')
    expect(apiCrumbs('4.1', model, 'controllers')).toEqual([
      { title: '4.1', href: '/docs/4.1' },
      { title: 'API', href: '/docs/4.1/api' },
      { title: 'Controllers', href: '/docs/4.1/api/controllers' },
    ])
  })
})
