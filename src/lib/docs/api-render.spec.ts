import { readdirSync } from 'node:fs'
import path from 'node:path'
import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import semver from 'semver'
import { describe, expect, it } from 'vitest'
import { modelLayouts } from '../../../scripts/lib/api-layout'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import {
  apiArticle,
  apiCrumbs,
  apiIndexArticle,
  apiKindArticle,
  apiSidebar,
  glanceArticle,
  renderApiIndex,
  runsAt,
} from '@/lib/docs/api-render'
import { apiModel, apiReexports, apiSections, lineVersions } from '@/lib/docs/api-site'
import { glanceTopic } from '@/lib/docs/glance'
import { CODE_PALETTES } from '@/lib/prose/highlight'
import { VERSIONS } from '@/config/versions'
import { lineSegment } from '@/lib/urls'

/** The first release whose `meocord/common` re-exports discord.js helpers, which its generated API lists. */
const REEXPORTS_SINCE = '4.3.0'

// Each line's path segment as versions.json gives it: `latest` for the current line
const docs41 = `/docs/${lineSegment('4.1', VERSIONS)}`

// A fixed release, so the layouts are checked against signatures that do not change with each sync.
const model = apiModel('4.1', '4.1.0-beta.4')!
// A symbol by the entry point it is imported from, wherever the line's API files it
const symbolOf = (entry: string, name: string) => {
  const location = model.locate(entry, name)!
  return model.symbol(location.section, location.symbol)!
}

describe('apiArticle', () => {
  it('lists the sections and members in the table of contents, at their anchors', () => {
    const { toc } = apiArticle(symbolOf('core', 'ShardContext'))
    expect(toc.filter(entry => entry.depth === 2).map(entry => entry.id)).toEqual(['examples', 'members'])
    const members = toc.filter(entry => entry.depth === 3)
    expect(members.length).toBeGreaterThan(0)
    expect(members.every(entry => entry.id === entry.title.toLowerCase())).toBe(true)
  })

  it('lists the Guide pages that teach it, after its reference, at an id of its own', () => {
    const symbol = symbolOf('decorator', 'Cooldown')
    const guide = [{ title: 'Cooldowns', href: `${docs41}/cooldowns` }]
    const { nodes, toc } = apiArticle(symbol, {}, guide)
    const markup = renderToStaticMarkup(Div({ children: nodes }).render())
    expect(toc.at(-1)).toEqual({ id: 'in-the-guide', title: 'In the Guide', depth: 2 })
    expect(apiArticle(symbol).toc.some(entry => entry.id === 'in-the-guide')).toBe(false)
    expect(markup).toContain('<aside data-guide-api="true" aria-labelledby="in-the-guide">')
    expect(markup).toContain('<h2 id="in-the-guide">In the Guide</h2>')
    expect(markup).toContain(`<a href="${docs41}/cooldowns">Cooldowns</a>`)
    expect(renderToStaticMarkup(Div({ children: apiArticle(symbol).nodes }).render())).not.toContain('In the Guide')
  })

  it('gives a function its parameters, returns and examples', () => {
    const { toc } = apiArticle(symbolOf('decorator', 'Cooldown'))
    // Its options under its parameters, from CooldownOptions
    expect(toc.map(entry => entry.id)).toEqual([
      'parameters',
      'seconds',
      'uses',
      'per',
      'bypass',
      'by',
      'returns',
      'examples',
    ])
  })

  it('keeps a section anchor clear of a member with the same name', () => {
    const symbol = { ...symbolOf('core', 'ShardContext') }
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
    renderToStaticMarkup(Div({ children: apiArticle(symbolOf(entry, name), withLayouts).nodes }).render())
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
    const href = model.href(model.locate('enum', 'CommandType')!)
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
    const symbol = symbolOf('decorator', 'Command')
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
    expect(cell).toBe(['(', '  | (new (...args: any[]) =&gt; GuardInterface)', '  | GuardWithParams', ')[]'].join('\n'))
  })

  it('keeps short code, and all code without layouts, on one line', () => {
    expect(blocks(html('common', 'createMetadata'))[0]).toBe(
      'createMetadata<T>(description?: string): MetadataDecorator<T>',
    )
    expect(blocks(html('decorator', 'Command', {})).every(block => !block.includes('\n'))).toBe(true)
  })

  it('leaves a blank line between overloads once any runs over lines', () => {
    const symbol = symbolOf('decorator', 'Command')
    const twice = { ...symbol, code: [symbol.code[0], symbol.code[0]] }
    const markup = renderToStaticMarkup(Div({ children: apiArticle(twice, layouts).nodes }).render())
    expect(blocks(markup)[0]).toContain(') => void\n\nCommand<')
  })
})

describe('apiSidebar', () => {
  it('follows the guides with one group per entry point, where a line is arranged so, and heads no category', () => {
    const byEntry = apiModel('4.0')!
    const current = byEntry.href({ section: 'decorator', symbol: 'Command' })
    const groups = apiSidebar('4.0', byEntry, current)
    const decorator = groups.find(group => group.title === 'meocord/decorator')!
    expect(decorator.items.find(item => item.current)?.title).toBe('Command')
    expect(groups.findIndex(group => group.title.startsWith('meocord/'))).toBeGreaterThan(0)
    // beta.6's symbols carry categories, but an entry point lists them in source order
    const beta6 = apiSidebar('4.1', apiModel('4.1', undefined, 'entry')!)
    expect(beta6.flatMap(group => group.items).some(item => item.category)).toBe(false)
  })
})

describe('the API by kind', () => {
  const html = (nodes: ReturnType<typeof apiArticle>['nodes']) =>
    renderToStaticMarkup(Div({ children: nodes }).render())

  it('groups the sidebar by kind, heading each category once, before its first symbol', () => {
    const groups = apiSidebar('4.1', apiModel('4.1')!)
    // The cheat sheets come first, then the kinds
    expect(groups[0].title).toBe('At a glance')
    expect(groups[0].items.map(item => item.title)).toEqual(['Decorators', 'respond()', 'Testing helpers', 'CLI'])
    expect(groups[1].title).toBe('Controllers')
    const decorators = groups.find(group => group.title === 'Decorators')!
    expect(decorators.items.find(item => item.title === 'Cooldown')?.category).toBe('Pipeline stages')
    const nav = renderToStaticMarkup(SidebarNav({ groups: [decorators] }).render())
    const headings = [...nav.matchAll(/<div data-nav-category="true" aria-hidden="true">([^<]+)<\/div>/g)].map(
      match => match[1],
    )
    expect(headings).toEqual([...new Set(decorators.items.map(item => item.category))])
    // Each category a list of its own, named by it for a screen reader, which the visible label is hidden from
    expect(nav).toMatch(
      new RegExp(
        `<ul aria-label="Pipeline stages"><li><a href="${docs41.replaceAll('.', '\\.')}/api/decorators/[A-Za-z]+"`,
      ),
    )
    expect(nav).toContain(`<a href="${docs41}/api/decorators/Cooldown"`)
    expect(nav.match(/<ul aria-label="Pipeline stages">[\s\S]*?<\/ul>/)![0]).toContain('/decorators/Cooldown"')
  })

  it('draws each cheat sheet from the API or the CLI: how each entry is called, and what it does', () => {
    const model = apiModel('4.1')!
    const sheet = (slug: string) => html(glanceArticle('4.1', model, glanceTopic(slug)!)!.nodes)
    const decorators = sheet('decorators')
    expect(decorators).toContain('<h1>Decorators at a glance</h1>')
    expect(decorators).toContain('<h2 id="pipeline-stages">Pipeline stages</h2>')
    expect(decorators).toContain(`<a href="${docs41}/api/decorators/Cooldown"><code>@Cooldown(options)</code></a>`)
    expect(decorators).toContain('<code>@UseGuard(...entries)</code>')
    const respond = sheet('respond')
    expect(respond).toContain('<code>respond(interaction)</code>')
    expect(respond).toContain(
      `<a href="${docs41}/api/responses/ResponseState#send"><code>send(payload, options?)</code></a>`,
    )
    expect(respond).toContain('<h2 id="properties">Properties</h2>')
    const testing = sheet('testing')
    expect(testing).toContain('<code>createMockMessage(overrides?)</code>')
    // A helper declared as a variable, with no signature of its own, is named
    expect(testing).toContain(`<a href="${docs41}/api/testing/createMockUser"><code>createMockUser</code></a>`)
    // Helpers only: an interface of the testing kind isn't one
    expect(testing).not.toContain('MockMessageOverrides')
    const cli = sheet('cli')
    // The current line's create runs the newest meocord; another line's names its own newest release
    const create = lineSegment('4.1', VERSIONS) === 'latest' ? 'meocord' : `meocord@${lineVersions('4.1')[0]}`
    expect(cli).toContain(`data-example="npx ${create} create my-bot"`)
    expect(cli).toContain(
      `<a href="${docs41}/api/cli/generate#controller"><code>meocord generate controller</code></a>`,
    )
    // An exact version's API has no cheat sheets
    expect(apiSections(apiModel('4.1', '4.1.0-beta.7')!).some(section => section.slug === 'glance')).toBe(false)
  })

  it('shows every symbol with its summary on the index, and a kind by category on its page', () => {
    const model = apiModel('4.1')!
    const index = html(apiIndexArticle('4.1', model).nodes)
    expect(index).toContain(
      `<h2 id="decorators" data-kind-heading="true"><a href="${docs41}/api/decorators">Decorators</a></h2>`,
    )
    expect(index).toContain(`<a href="${docs41}/api/decorators/Cooldown"><code>Cooldown</code></a>`)
    const kind = apiKindArticle(model, 'decorators')!
    expect(html(kind.nodes)).toContain('<h2 id="decorators-pipeline-stages">Pipeline stages</h2>')
    expect(kind.toc.map(entry => entry.title)).toContain('Pipeline stages')
    expect(apiKindArticle(model, 'nothing')).toBeUndefined()
    // The CLI's page names the help every command takes, which its manifest leaves out
    expect(html(apiKindArticle(model, 'cli')!.nodes)).toContain(
      '<p>Every command also takes <code>-h, --help</code>, which prints its usage, arguments and options, as <code>meocord help &lt;command&gt;</code> does.</p>',
    )
    // The index and kinds exist only where the API is arranged by kind
    expect(renderApiIndex('4.0')).toBeUndefined()
  })

  it("lists what meocord/common re-exports from discord.js under Utilities, linked to discord.js's documentation", () => {
    const model = apiModel('4.3')!
    const docs43 = `/docs/${lineSegment('4.3', VERSIONS)}`
    const index = html(apiIndexArticle('4.3', model).nodes)
    const section = index.slice(index.indexOf('<h2 id="utilities"'), index.indexOf('<h2 id="testing"'))
    expect(section).toContain('<h3 id="utilities-re-exported-from-discord-js">Re-exported from discord.js</h3>')
    expect(section).toContain('<a href="https://discord.js.org/docs/packages/formatters/stable">')
    expect(section).toContain('<li><code>userMention</code></li>')
    expect(section).toContain('<li><code>type TimestampStylesString</code></li>')
    // Discord.js documents them: none links to a page here
    expect(section).not.toContain(`${docs43}/api/utilities/userMention`)
    const kind = apiKindArticle(model, 'utilities')!
    expect(html(kind.nodes)).toContain(
      '<h2 id="utilities-re-exported-from-discord-js">Re-exported from discord.js</h2>',
    )
    expect(kind.toc.map(entry => entry.title)).toContain('Re-exported from discord.js')
    // Only Utilities lists them
    expect(html(apiKindArticle(model, 'responses')!.nodes)).not.toContain('Re-exported from')
    // A line whose meocord re-exports nothing from discord.js has no such heading
    expect(html(apiIndexArticle('4.2', apiModel('4.2')!).nodes)).not.toContain('Re-exported from')
  })

  it(`reads the re-exports from ${REEXPORTS_SINCE}'s generated API: 44 values and 4 types`, () => {
    const [common, ...others] = apiReexports(REEXPORTS_SINCE)
    expect(others).toEqual([])
    expect(common).toMatchObject({ entry: 'meocord/common', from: 'discord.js' })
    expect(common!.values).toHaveLength(44)
    expect(common!.types).toEqual([
      'EscapeMarkdownOptions',
      'FormatEmojiOptions',
      'RecursiveArray',
      'TimestampStylesString',
    ])
  })

  // Compared by semver, so a later patch release is checked with no change here
  it(`finds re-exports in every generated API from ${REEXPORTS_SINCE} on, and in none before it`, () => {
    const versions = readdirSync(path.join(process.cwd(), 'generated', 'api')).map(file => path.basename(file, '.json'))
    const since = versions.filter(version => semver.gte(version, REEXPORTS_SINCE))
    const earlier = versions.filter(version => semver.lt(version, REEXPORTS_SINCE))
    expect(since).toContain(REEXPORTS_SINCE)
    expect(earlier).toEqual(expect.arrayContaining(['4.0.1', '4.1.2', '4.2.3']))
    for (const version of since) {
      expect(apiReexports(version), version).toEqual(
        expect.arrayContaining([expect.objectContaining({ entry: 'meocord/common', from: 'discord.js' })]),
      )
    }
    for (const version of earlier) expect(apiReexports(version), version).toEqual([])
  })

  it('says where an entry runs, after its description, each stage linked to its place in the figure', () => {
    const model = apiModel('4.1')!
    const defer = model.symbol('decorators', 'Defer')!
    const stages = runsAt('4.1', defer)
    expect(stages.map(stage => stage.href)).toEqual([
      `${docs41}/how-a-call-runs#stage-defer`,
      `${docs41}/how-a-call-runs#stage-defer-lock`,
    ])
    const { nodes, toc } = apiArticle(defer, {}, [], stages)
    expect(toc[0]).toEqual({ id: 'where-it-runs', title: 'Where it runs', depth: 2 })
    const markup = html(nodes)
    expect(markup).toContain('<h2 id="where-it-runs">Where it runs</h2>')
    expect(markup).toContain(`<a href="${docs41}/how-a-call-runs#stage-defer-lock">@Defer: lock</a> — `)
    expect(markup.indexOf('where-it-runs')).toBeLessThan(markup.indexOf('id="parameters"'))
    // A tag's older stage name stands for each stage it covers
    expect(runsAt('4.1', model.symbol('decorators', 'Observer')!).map(stage => stage.name)).toEqual([
      'Observers: onStart',
      'Observers: onSettled',
    ])
    // No note without a tag, nor where the Guide, and so the figure, isn't rendered
    expect(runsAt('4.1', model.symbol('decorators', 'MeoCord')!)).toEqual([])
    expect(apiArticle(defer).toc.some(entry => entry.id === 'where-it-runs')).toBe(false)
    expect(runsAt('4.0', defer)).toEqual([])
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
      { title: '4.1', href: `${docs41}` },
      { title: 'API', href: `${docs41}/api` },
      { title: 'Controllers', href: `${docs41}/api/controllers` },
    ])
  })
})

// A fixed release whose options and members hold each shape of default: a code span, prose around code spans, prose
// over two lines, and prose TypeDoc fenced
const tables = apiModel('4.3', '4.3.3')!
const articleOf = (entry: string, name: string) => {
  const location = tables.locate(entry, name)!
  const symbol = tables.symbol(location.section, location.symbol)!
  return renderToStaticMarkup(Div({ children: apiArticle(symbol).nodes }).render())
}
const cellsOf = (row: string) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1])
const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
/** A parameter's row by its anchor, and the description row beneath it. */
const rowOf = (markup: string, id: string) => {
  const found = markup.match(
    new RegExp(`<tr id="${id}">([\\s\\S]*?)</tr>(?:<tr data-description="true">([\\s\\S]*?)</tr>)?`),
  )
  return { cells: cellsOf(found?.[1] ?? ''), description: found?.[2] }
}

describe('a parameters table', () => {
  const meocord = articleOf('meocord/decorator', 'MeoCord')
  const table = meocord.match(/<div[^>]*data-params="true"[\s\S]*?<\/table>/)![0]
  const rows = [...table.split('<tbody>')[1].matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)].map(([, attributes, inner]) => ({
    described: attributes.includes('data-description'),
    cells: cellsOf(inner),
    inner,
  }))

  it('gives each parameter a row of short cells, its description in a row beneath it across every column', () => {
    expect([...table.matchAll(/<th>([^<]*)<\/th>/g)].map(match => match[1])).toEqual([
      'Name',
      'Type',
      'Default',
      'Since',
    ])
    expect(rows.filter(row => row.described).length).toBeGreaterThan(20)
    rows.forEach((row, index) => {
      if (!row.described) return expect(row.cells).toHaveLength(4)
      expect(row.inner).toMatch(/^<td colSpan="4">/)
      expect(row.cells).toHaveLength(1)
      expect(rows[index - 1].described).toBe(false)
    })
  })

  it('keeps an option’s anchor on its row, the one that names it', () => {
    const { cells, description } = rowOf(meocord, 'themefortimeoutms')
    expect(cells[0]).toBe('<code>options.themeForTimeoutMs?</code>')
    expect(textOf(description!)).toMatch(/^How long a lookup through a themeFor resolver may take/)
    expect(table).not.toMatch(/<tr[^>]*data-description[^>]*id=/)
  })
})

describe('a default', () => {
  it('in a parameter’s row reads as Markdown, a lone code span as the code it is', () => {
    const meocord = articleOf('meocord/decorator', 'MeoCord')
    const single = rowOf(meocord, 'themefortimeoutms').cells[2]
    expect(single.match(/<code>[^<]*<\/code>/g)).toEqual(['<code>1000</code>'])
    expect(textOf(single)).toBe('1000')
    expect(rowOf(meocord, 'waitforready').cells[2]).toContain(
      '<code>false</code>: calls are handled while the hooks run',
    )
    // Its second line too, joined as Markdown joins a paragraph's lines
    expect(textOf(rowOf(meocord, 'globalstagesonevents').cells[2])).toBe(
      'true; false in the next major version (5.0), as meocord#502 plans',
    )
  })

  it('under a member reads as Markdown after its label', () => {
    const config = articleOf('meocord/interface', 'MeoCordConfig')
    const lines = [...config.matchAll(/<p>Default: ([\s\S]*?)<\/p>/g)].map(match => match[1])
    expect(lines).toContain('<code>10_000</code>')
    expect(lines).toContain('Every command registered globally, each time the bot starts.')
    expect(lines).toContain('One connection, or whatever <code>clientOptions.shards</code> says.')
    expect(lines.map(textOf)).toContain(
      "'debug' while NODE_ENV is development, as under meocord start --dev, and 'log' otherwise",
    )
  })
})
