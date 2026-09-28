import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// A Guide of four pages in a scratch root: two chapters in reading order, and a recipe apart.
const root = mkdtempSync(path.join(tmpdir(), 'guide-site-'))
mkdirSync(path.join(root, 'content', '4.1-next'), { recursive: true })
const lines = [{ line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.7'] }]
writeFileSync(path.join(root, 'versions.json'), JSON.stringify({ package: 'meocord', since: '4.1.0-beta.0', lines }))
const write = (id: string, frontmatter: string, body: string) =>
  writeFileSync(path.join(root, 'content', '4.1-next', `${id}.md`), `---\nid: ${id}\n${frontmatter}\n---\n\n${body}\n`)
const learn = 'learn: [One thing, Another]'
write(
  'guards',
  `title: Guards\nchapter: pipeline\norder: 2\nsummary: Guard calls.\n${learn}\nrequires: [services, first-command]\napi: [decorators/UseGuard]`,
  '## How it works\n\nSee [services](guide:services#providers), [tickets](guide:recipes/tickets), [a planned page](guide:slash-commands), [the migration guide](guide:migrating#start) and [`@UseGuard`](api:decorators/UseGuard).',
)
write(
  'services',
  `title: Services\nchapter: structure\norder: 1\nsummary: Share state.\n${learn}`,
  '## Providers\n\nText, in a project from `npx {{meocord}} create my-bot`.',
)
write('how-a-call-runs', `title: How a call runs\nchapter: pipeline\norder: 1\nsummary: The order.\n${learn}`, 'Text.')
write('tickets', 'title: A ticket system\nchapter: appendix\ngroup: recipes\norder: 1\nsummary: Tickets.', 'Text.')
write('broken', 'title: Broken\nchapter: nowhere', 'Text.')

vi.stubEnv('MEOCORD_DOCS_ROOT', root)
vi.stubEnv('DOCS_NEXT', '1')
const { guideEnabled, guideEntries, guideSidebar, guideTabs, guideView, resolveGuideLink } =
  await import('@/lib/docs/guide-site')
const { guideArticle } = await import('@/lib/docs/render')
const { Div } = await import('@meonode/ui')
const { renderToStaticMarkup } = await import('react-dom/server')

describe('the Guide', () => {
  it('is rendered where DOCS_NEXT is set and the line has one, in reading order, invalid pages left out', () => {
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

  it('resolves guide: and api: links, the reference pages and planned pages included', () => {
    expect(resolveGuideLink('4.1', 'guide:services#providers')).toBe('/docs/4.1/services#providers')
    expect(resolveGuideLink('4.1', 'guide:recipes/tickets')).toBe('/docs/4.1/recipes/tickets')
    expect(resolveGuideLink('4.1', 'guide:slash-commands')).toBe('/docs/4.1/slash-commands')
    expect(resolveGuideLink('4.1', 'guide:migrating#start')).toBe('/docs/4.1/migrating#start')
    expect(resolveGuideLink('4.1', 'guide:changelog')).toBe('/docs/4.1/changelog')
    expect(resolveGuideLink('4.1', 'api:decorators/UseGuard')).toBe('/docs/4.1/api/decorators/UseGuard')
    expect(resolveGuideLink('4.1', 'https://discord.com')).toBe('https://discord.com')
  })

  it('groups the sidebar by chapter in reading order, and the appendix by group, marking the page read', () => {
    const [guards] = guideEntries('4.1').filter(entry => entry.page.id === 'guards')
    expect(
      guideSidebar('4.1', guards.page).map(group => [group.title, group.items.map(item => [item.title, item.current])]),
    ).toEqual([
      ['Structuring your app', [['Services', false]]],
      [
        'The request pipeline',
        [
          ['How a call runs', false],
          ['Guards', true],
        ],
      ],
      ['Recipes', [['A ticket system', false]]],
    ])
  })

  it('places a page in reading order, with what it requires, and keeps the appendix apart', () => {
    const view = guideView('4.1', 'guards')!
    expect(view.previous).toEqual({ title: 'How a call runs', href: '/docs/4.1/how-a-call-runs' })
    expect(view.next).toBeUndefined()
    expect(view.progress).toEqual({ index: 3, total: 3 })
    expect(view.requires).toEqual([{ title: 'Services', href: '/docs/4.1/services' }])
    expect(view.crumbs.map(crumb => crumb.title)).toEqual(['4.1', 'The request pipeline', 'Guards'])

    const recipe = guideView('4.1', 'recipes/tickets')!
    expect([recipe.previous, recipe.next, recipe.progress]).toEqual([undefined, undefined, undefined])
    expect(recipe.canonical).toBe('/docs/4.1/recipes/tickets')
    expect(guideView('4.1', 'tickets')).toBeUndefined()
  })

  it('renders the template: summary, what it teaches and requires, the API it covers, and the pager', () => {
    const html = renderToStaticMarkup(Div({ children: guideArticle('4.1', guideView('4.1', 'guards')!) }).render())
    expect(html).toContain('<p data-summary="true">Guard calls.</p>')
    expect(html).toContain('You&#x27;ll learn')
    expect(html).toContain('Before this')
    expect(html).toContain('<a href="/docs/4.1/services">Services</a>')
    expect(html).toContain('<a href="/docs/4.1/api/decorators/UseGuard">UseGuard</a>')
    expect(html).toContain('<a href="/docs/4.1/how-a-call-runs" rel="prev">')
    expect(html).toContain('The request pipeline · page 3 of 3')
  })

  it("offers the Guide and the API as the sidebar's tabs, marking the one read", () => {
    expect(guideTabs('4.1', 'guide')).toEqual([
      { title: 'Guide', href: '/docs/4.1/services', current: true },
      // The API opens on its index, where it is arranged by kind
      { title: 'API', href: '/docs/4.1/api', current: false },
    ])
    expect(guideTabs('4.1', 'api').map(tab => tab.current)).toEqual([false, true])
  })
})
