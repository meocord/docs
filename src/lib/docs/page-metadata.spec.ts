import { afterEach, describe, expect, it, vi } from 'vitest'
import * as guide from '@/app/docs/[line]/[...slug]/page'
import * as landing from '@/app/docs/[line]/page'
import * as api from '@/app/docs/[line]/api/[...path]/page'
import * as changelog from '@/app/docs/[line]/changelog/page'
import * as release from '@/app/docs/[line]/changelog/[version]/page'
import * as migrating from '@/app/docs/[line]/migrating/page'
import * as missing from '@/app/docs/[line]/missing/[id]/page'
import * as home from '@/app/page'
import * as notFound from '@/app/not-found'
import { describe as summarize, DESCRIPTION_LENGTH, firstParagraph, plainText } from '@/lib/docs/page-metadata'
import { ogImage } from '@/lib/og/cards'
import { VERSIONS } from '@/config/versions'
import { docsHref, lineSegment } from '@/lib/urls'

// Each line's path segment as versions.json gives it: `latest` for the current line
const docs41 = `/docs/${lineSegment('4.1', VERSIONS)}`
const docs40 = `/docs/${lineSegment('4.0', VERSIONS)}`

const params = <T>(value: T) => ({ params: Promise.resolve(value) }) as never
const card = ogImage('site', 'home')
// The site is not indexable until launch, so every page is noindex, nofollow here.
const closed = { index: false, follow: false }

/** The whole metadata object a page type should produce. */
function expected(title: string, description: string, canonical?: string, type = 'article') {
  return {
    title: { absolute: title },
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    robots: closed,
    openGraph: {
      siteName: 'MeoCord',
      type,
      locale: 'en_US',
      title,
      description,
      ...(canonical ? { url: canonical } : {}),
      images: [card],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

describe('page metadata', () => {
  it('the home page: the brand alone, canonical at the root', () => {
    expect(home.metadata).toEqual(
      expected(
        'MeoCord',
        'Decorator-based Discord bots, with the pipeline you’d build yourself: guards, interceptors, pipes and a testing module, for discord.js 14.',
        '/',
        'website',
      ),
    )
  })

  it("a Guide page: its summary, canonical at its line's path", async () => {
    expect(await guide.generateMetadata(params({ line: '4.1', slug: ['guards'] }))).toEqual(
      expected(
        'Guards · MeoCord 4.1',
        'Decide whether a call may run, before the handler or anything costly sees it, and tell the user why when it may not.',
        `${docs41}/guards`,
      ),
    )
  })

  it("a Guide page on another line: that line's title, canonical at its path", async () => {
    const meta = await guide.generateMetadata(params({ line: '4.0', slug: ['guards'] }))
    expect(meta.title).toEqual({ absolute: 'Guards · MeoCord 4.0' })
    expect(meta.alternates).toEqual({ canonical: `${docs40}/guards` })
    expect(meta.openGraph).toMatchObject({ url: `${docs40}/guards` })
  })

  it("an appendix page, and a recipe at its group's path", async () => {
    expect(await guide.generateMetadata(params({ line: '4.1', slug: ['what-can-i-build'] }))).toEqual(
      expected(
        'What you can build · MeoCord 4.1',
        'Every kind of handler MeoCord runs, from slash commands to gateway events, each with a small working example.',
        `${docs41}/what-can-i-build`,
      ),
    )
    expect(await guide.generateMetadata(params({ line: '4.1', slug: ['recipes', 'cooldown-stores'] }))).toEqual(
      expected(
        'Cooldown stores · MeoCord 4.1',
        'Keep cooldown counts in Redis, across shards, or in PostgreSQL, SQLite or MongoDB, and check a store of your own.',
        `${docs41}/recipes/cooldown-stores`,
      ),
    )
  })

  it('a line’s landing: its overview, canonical at the overview', async () => {
    expect(await landing.generateMetadata(params({ line: '4.1' }))).toEqual(
      expected(
        'Overview · MeoCord 4.1',
        'What MeoCord is, what a bot built with it is made of, and how its parts run from build to shutdown.',
        `${docs41}/overview`,
      ),
    )
  })

  it('the API’s cheat sheets and CLI indexes: canonical at their section, naming what they list', async () => {
    for (const [section, title, description] of [
      ['glance', 'At a glance · API · MeoCord 4.1', /^MeoCord 4\.1 at a glance, a cheat sheet per task: /],
      ['cli', 'CLI · API · MeoCord 4.1', /^The meocord command line of MeoCord 4\.1: .*\bcreate\b/],
    ] as const) {
      const meta = await api.generateMetadata(params({ line: '4.1', path: [section] }))
      expect(meta.title, section).toEqual({ absolute: title })
      expect(meta.description, section).toMatch(description)
      expect(meta.alternates, section).toEqual({
        canonical: docsHref({ kind: 'api-index', line: '4.1', section }, VERSIONS),
      })
    }
  })

  it('an API symbol: what it is, its doc comment’s summary, and what the page holds', async () => {
    expect(await api.generateMetadata(params({ line: '4.1', path: ['decorators', 'Command'] }))).toEqual(
      expected(
        'Command · meocord/decorator · MeoCord 4.1',
        // Long enough that what the page holds would be cut, so the summary ends the description
        'Command (function in meocord/decorator): Routes a command, a component or a modal submission to the method it decorates.',
        `${docs41}/api/decorators/Command`,
      ),
    )
  })

  it('an exact version’s API symbol: never indexed, canonical at the line’s page', async () => {
    const meta = await api.generateMetadata(params({ line: '4.1', path: ['4.1.0-beta.1', 'decorators', 'Command'] }))
    expect(meta).toEqual({
      ...expected(
        'Command · meocord/decorator 4.1.0-beta.1 · MeoCord 4.1',
        'Command (function in meocord/decorator): Decorator to register command methods in a controller. Types and examples for MeoCord 4.1.',
        `${docs41}/api/decorators/Command`,
      ),
    })
  })

  it('a CLI command: what it is, its one-line summary as a sentence, and what the page holds', async () => {
    const meta = await api.generateMetadata(params({ line: '4.1', path: ['cli', 'generate'] }))
    expect(meta.description).toBe(
      'meocord generate (CLI command): Generate components. Usage, options and examples for MeoCord 4.1.',
    )
  })

  it("a changelog, a release's page and a migration guide", async () => {
    expect(await changelog.generateMetadata(params({ line: '4.1' }))).toEqual(
      expected(
        'Changelog · MeoCord 4.1',
        'Every MeoCord 4.1 release, newest first, with its day and what it holds, and the newest in summary.',
        `${docs41}/changelog`,
      ),
    )
    expect(await release.generateMetadata(params({ line: '4.1', version: '4.1.0-beta.1' }))).toEqual(
      expected(
        '4.1.0-beta.1 changelog · MeoCord 4.1',
        'What changed in MeoCord 4.1.0-beta.1: 1 minor change and 2 patch changes.',
        `${docs41}/changelog/4.1.0-beta.1`,
      ),
    )
    expect(await release.generateMetadata(params({ line: '4.1', version: '4.0.0' }))).toEqual({})
    expect(await migrating.generateMetadata(params({ line: '4.1' }))).toEqual(
      expected(
        'Migrating · MeoCord 4.1',
        'Upgrading a bot to MeoCord 4.1: what changed, and what to do about it.',
        `${docs41}/migrating`,
      ),
    )
  })

  it('a page missing from a line: noindex, with no canonical', async () => {
    expect(await missing.generateMetadata(params({ line: '4.0', id: 'first-command' }))).toEqual(
      expected(
        'Your first command (not documented) · MeoCord 4.0',
        'Your first command is not documented for MeoCord 4.0. See where it is, and what 4.0 documents.',
      ),
    )
  })

  it('the 404: noindex, with no canonical', () => {
    expect(notFound.metadata).toEqual(
      expected(
        'Page not found · MeoCord',
        'The address may be from an older version of the docs, or the page has moved.',
      ),
    )
  })

  it('shares the home card, at its content-hashed path', () => {
    expect(card.url).toMatch(/^\/og\/site\/home\.[0-9a-f]{12}\.png$/)
  })
})

describe('once the site is indexable', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('indexes a page of the current line, or of no line, unless it asks not to be, and follows its links either way', async () => {
    vi.stubEnv('SITE_INDEXABLE', 'true')
    vi.resetModules()
    const { pageMetadata } = await import('@/lib/docs/page-metadata')
    const { CURRENT_LINE } = await import('@/config/versions')
    expect(pageMetadata({ title: 'Guards', line: CURRENT_LINE, description: 'x' }).robots).toEqual({
      index: true,
      follow: true,
    })
    expect(pageMetadata({ description: 'x' }).robots).toEqual({ index: true, follow: true })
    expect(pageMetadata({ title: 'Old', line: CURRENT_LINE, description: 'x', index: false }).robots).toEqual({
      index: false,
      follow: true,
    })
  })

  it('keeps every other line out of search indexes, following its links', async () => {
    vi.stubEnv('SITE_INDEXABLE', 'true')
    vi.resetModules()
    const { pageMetadata } = await import('@/lib/docs/page-metadata')
    const { CURRENT_LINE, VERSIONS } = await import('@/config/versions')
    const others = VERSIONS.lines.filter(({ line }) => line !== CURRENT_LINE)
    expect(others.length).toBeGreaterThan(0)
    for (const { line } of others)
      expect(pageMetadata({ title: 'Guards', line, description: 'x' }).robots, line).toEqual({
        index: false,
        follow: true,
      })
  })
})

describe('descriptions', () => {
  it('read as text: links, code, emphasis and HTML reduced to their words', () => {
    expect(plainText('Use [`respond()`](/docs/x) to **answer**, _once_; <br/>then `defer`.')).toBe(
      'Use respond() to answer, once; then defer.',
    )
  })

  it('come from the first paragraph of prose', () => {
    expect(firstParagraph('## Heading\n\n::example{file="x"}\n\n- a list\n\nThe first paragraph.\n\nThe second.')).toBe(
      'The first paragraph.',
    )
  })

  it('fit a search result, cut at a word', () => {
    const text = summarize('word '.repeat(60))
    expect(text.length).toBeLessThanOrEqual(DESCRIPTION_LENGTH)
    expect(text).toMatch(/word…$/)
    expect(summarize('Short.')).toBe('Short.')
  })
})
