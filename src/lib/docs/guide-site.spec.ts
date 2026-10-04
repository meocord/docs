import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { VERSIONS } from '@/config/versions'
import { lineSegment } from '@/lib/urls'

// Each line's path segment as versions.json gives it: `latest` for the current line
const docs41 = `/docs/${lineSegment('4.1', VERSIONS)}`

// A Guide of four pages in a scratch root: two chapters in reading order, and a recipe apart.
const root = mkdtempSync(path.join(tmpdir(), 'guide-site-'))
mkdirSync(path.join(root, 'content', '4.1'), { recursive: true })
const lines = [{ line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.7'] }]
writeFileSync(
  path.join(root, 'versions.json'),
  JSON.stringify({
    package: 'meocord',
    since: '4.1.0-beta.0',
    provenance: { issuer: 'https://token.actions.githubusercontent.com' },
    lines,
  }),
)
const write = (id: string, frontmatter: string, body: string) =>
  writeFileSync(path.join(root, 'content', '4.1', `${id}.md`), `---\nid: ${id}\n${frontmatter}\n---\n\n${body}\n`)
const learn = 'learn: [One thing, Another]'
write(
  'guards',
  `title: Guards\nchapter: pipeline\norder: 2\nsummary: Guard calls.\n${learn}\nrequires: [services, first-command]\napi: [decorators/UseGuard, decorators/Cooldown#per]`,
  '## How it works\n\nSee [services](guide:services#providers), [tickets](guide:recipes/tickets), [a planned page](guide:slash-commands), [the migration guide](guide:migrating#start) and [`@UseGuard`](api:decorators/UseGuard).',
)
write(
  'services',
  `title: Services\nchapter: structure\norder: 1\nsummary: Share state.\n${learn}`,
  '## Providers\n\nText, in a project from `npx {{meocord}} create my-bot`.',
)
write('how-a-call-runs', `title: How a call runs\nchapter: pipeline\norder: 1\nsummary: The order.\n${learn}`, 'Text.')
write(
  'tickets',
  'title: A ticket system\nchapter: appendix\ngroup: recipes\norder: 1\nsummary: Tickets.',
  'Text.\n\n::example-bot{id="demo"}',
)
// One example bot, drawn by the ticket recipe here, that illustrates Guards
writeFileSync(
  path.join(root, 'content', '4.1', 'example-bots.json'),
  JSON.stringify({
    repository: 'https://github.com/meocord/examples',
    bots: [
      {
        id: 'demo',
        title: 'Demo',
        shows: [{ what: 'A `guard`', files: ['src/a.guard.ts'], guide: ['guards#how-it-works'] }],
      },
    ],
  }),
)
write('broken', 'title: Broken\nchapter: nowhere', 'Text.')

// The lines with a playground runtime, as the build's manifest would name them
const frames: Record<string, string> = { '4.1': '/playground/4.1.0-beta.7.0123456789.html' }
vi.mock('@/lib/docs/playground-site', () => ({ playgroundFrame: (line: string) => frames[line] }))

vi.stubEnv('MEOCORD_DOCS_ROOT', root)
const { guideEnabled, guideEntries, guidePagesTeaching, guideSidebar, guideTabs, guideView, resolveGuideLink } =
  await import('@/lib/docs/guide-site')
const { guideArticle } = await import('@/lib/docs/render')
const { Div } = await import('@meonode/ui')
const { renderToStaticMarkup } = await import('react-dom/server')

describe('the Guide', () => {
  it('is rendered for a line whose guides are authored, in reading order, invalid pages left out', () => {
    expect(guideEnabled('4.1')).toBe(true)
    expect(guideEnabled('4.0')).toBe(false)
    expect(guideEntries('4.1').map(entry => entry.page.id)).toEqual([
      'services',
      'how-a-call-runs',
      'guards',
      'tickets',
    ])
  })

  it("writes the line's package spec for {{meocord}}: its prerelease tag while the line is in prerelease", () => {
    const services = guideEntries('4.1').find(entry => entry.page.id === 'services')!
    expect(services.body).toContain('in a project from `npx meocord@beta create my-bot`')
  })

  it('finds the Guide pages that teach an API entry, one of its members included, and none where it is not rendered', () => {
    expect(guidePagesTeaching('4.1', 'decorators', 'UseGuard')).toEqual([{ title: 'Guards', href: `${docs41}/guards` }])
    expect(guidePagesTeaching('4.1', 'decorators', 'Cooldown')).toEqual([{ title: 'Guards', href: `${docs41}/guards` }])
    expect(guidePagesTeaching('4.1', 'decorators', 'UseGuards')).toEqual([])
    expect(guidePagesTeaching('4.0', 'decorators', 'UseGuard')).toEqual([])
  })

  it('resolves guide: and api: links, the reference pages and planned pages included', () => {
    expect(resolveGuideLink('4.1', 'guide:services#providers')).toBe(`${docs41}/services#providers`)
    expect(resolveGuideLink('4.1', 'guide:recipes/tickets')).toBe(`${docs41}/recipes/tickets`)
    expect(resolveGuideLink('4.1', 'guide:slash-commands')).toBe(`${docs41}/slash-commands`)
    expect(resolveGuideLink('4.1', 'guide:migrating#start')).toBe(`${docs41}/migrating#start`)
    expect(resolveGuideLink('4.1', 'guide:changelog')).toBe(`${docs41}/changelog`)
    expect(resolveGuideLink('4.1', 'api:decorators/UseGuard')).toBe(`${docs41}/api/decorators/UseGuard`)
    // A CLI command, and a subcommand at its anchor on the command's page
    expect(resolveGuideLink('4.1', 'api:cli/build')).toBe(`${docs41}/api/cli/build`)
    expect(resolveGuideLink('4.1', 'api:cli/generate#controller')).toBe(`${docs41}/api/cli/generate#controller`)
    expect(resolveGuideLink('4.1', 'https://discord.com')).toBe('https://discord.com')
  })

  it('groups the sidebar by chapter in reading order, and the appendix by group, marking the page read', () => {
    const outline = (path: string) =>
      guideSidebar('4.1', path).map(group => [group.title, group.items.map(item => [item.title, item.current])])
    expect(outline('guards')).toEqual([
      // The playground is a page of the first group, where the line has one
      [
        'Structuring your app',
        [
          ['Services', false],
          ['Playground', false],
        ],
      ],
      [
        'The request pipeline',
        [
          ['How a call runs', false],
          ['Guards', true],
        ],
      ],
      ['Recipes', [['A ticket system', false]]],
    ])
    expect(outline('playground')[0][1]).toEqual([
      ['Services', false],
      ['Playground', true],
    ])
    expect(outline('recipes/tickets').at(-1)).toEqual(['Recipes', [['A ticket system', true]]])
    expect(guideSidebar('4.1', 'guards')[0].items.at(-1)?.href).toBe(`${docs41}/playground`)
    // A line with no playground runtime has no Playground page to list
    delete frames['4.1']
    expect(outline('guards')[0]).toEqual(['Structuring your app', [['Services', false]]])
    frames['4.1'] = '/playground/4.1.0-beta.7.0123456789.html'
  })

  it('places a page in reading order, with what it requires, and keeps the appendix apart', () => {
    const view = guideView('4.1', 'guards')!
    expect(view.previous).toEqual({ title: 'How a call runs', href: `${docs41}/how-a-call-runs` })
    expect(view.next).toBeUndefined()
    expect(view.progress).toEqual({ index: 3, total: 3 })
    expect(view.requires).toEqual([{ title: 'Services', href: `${docs41}/services` }])
    expect(view.crumbs.map(crumb => crumb.title)).toEqual(['4.1', 'The request pipeline', 'Guards'])

    const recipe = guideView('4.1', 'recipes/tickets')!
    expect([recipe.previous, recipe.next, recipe.progress]).toEqual([undefined, undefined, undefined])
    expect(recipe.canonical).toBe(`${docs41}/recipes/tickets`)
    expect(guideView('4.1', 'tickets')).toBeUndefined()
  })

  it('renders the template: summary, what it teaches and requires, the API it covers, and the pager', () => {
    const html = renderToStaticMarkup(Div({ children: guideArticle('4.1', guideView('4.1', 'guards')!) }).render())
    expect(html).toContain('<p data-summary="true">Guard calls.</p>')
    expect(html).toContain('You&#x27;ll learn')
    expect(html).toContain('Before this')
    expect(html).toContain(`<a href="${docs41}/services">Services</a>`)
    expect(html).toContain(`<a href="${docs41}/api/decorators/UseGuard">UseGuard</a>`)
    expect(html).toContain(`<a href="${docs41}/how-a-call-runs" rel="prev">`)
    expect(html).toContain('The request pipeline · page 3 of 3')
  })

  it('draws an example bot from its list, and links it from each page it illustrates', () => {
    const render = (pagePath: string) =>
      renderToStaticMarkup(Div({ children: guideArticle('4.1', guideView('4.1', pagePath)!) }).render())
    const drawn = render('recipes/tickets')
    expect(drawn).toContain(
      '<a href="https://github.com/meocord/examples/tree/main/demo"><code>demo/</code> on GitHub</a>',
    )
    expect(drawn).toContain(`. See <a href="${docs41}/guards#how-it-works">How it works</a>.`)
    expect(drawn).toContain(
      '<a href="https://github.com/meocord/examples/blob/main/demo/src/a.guard.ts"><code>a.guard.ts</code></a>',
    )

    const guards = render('guards')
    expect(guards).toContain(
      '<aside data-guide-bots="true" aria-labelledby="guide-bots"><h2 id="guide-bots">Example bots</h2>',
    )
    expect(guards).toContain(`<a href="${docs41}/example-bots#demo">Demo</a>: A <code>guard</code>, in `)
    expect(render('services')).not.toContain('data-guide-bots')
  })

  it("offers the Guide and the API as the sidebar's tabs, marking the one read", () => {
    // The playground is a page of the Guide, not a tab of its own
    expect(guideTabs('4.1', 'guide')).toEqual([
      { title: 'Guide', href: `${docs41}/services`, current: true },
      // The API opens on its index, where it is arranged by kind
      { title: 'API', href: `${docs41}/api`, current: false },
    ])
    expect(guideTabs('4.1', 'api').map(tab => tab.current)).toEqual([false, true])
  })
})
