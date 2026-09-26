import { afterEach, describe, expect, it, vi } from 'vitest'
import * as guide from '@/app/docs/[line]/[slug]/page'
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

  it('a guide on a prerelease line: its first paragraph, canonical at its line', async () => {
    expect(await guide.generateMetadata(params({ line: '4.1', slug: 'guards' }))).toEqual(
      expected(
        'Guards · MeoCord 4.1',
        'A guard decides whether a handler runs. It implements canActivate, returning true to let the call through and false to stop it silently. To tell the user…',
        '/docs/4.1/guards',
      ),
    )
  })

  it('a guide on the current line: canonical at latest', async () => {
    const meta = await guide.generateMetadata(params({ line: '4.0', slug: 'guards' }))
    expect(meta.title).toEqual({ absolute: 'Guards · MeoCord 4.0' })
    expect(meta.alternates).toEqual({ canonical: '/docs/latest/guards' })
    expect(meta.openGraph).toMatchObject({ url: '/docs/latest/guards' })
  })

  it('a tutorial page and a recipe page, as guides', async () => {
    expect(await guide.generateMetadata(params({ line: '4.1', slug: 'tutorial' }))).toEqual(
      expected(
        'Tutorial: a feedback bot · MeoCord 4.1',
        'This tutorial builds a complete bot, a step at a time, on top of A first command. Members send feedback with /feedback. It opens a form, and the bot…',
        '/docs/4.1/tutorial',
      ),
    )
    expect(await guide.generateMetadata(params({ line: '4.1', slug: 'recipe-tickets' }))).toEqual(
      expected(
        'A ticket system · MeoCord 4.1',
        '/ticket asks for a subject and details in a modal, opens a private thread with the member in it, and posts a Close button that the member or the staff…',
        '/docs/4.1/recipe-tickets',
      ),
    )
  })

  it('a line’s landing: its overview, canonical at the overview', async () => {
    expect(await landing.generateMetadata(params({ line: '4.1' }))).toEqual(
      expected(
        'Overview · MeoCord 4.1',
        'MeoCord is a framework for Discord bots built on discord.js. You write a bot as controllers and services, and decorators connect them to Discord…',
        '/docs/4.1/overview',
      ),
    )
  })

  it('an API symbol: its doc comment’s summary', async () => {
    expect(await api.generateMetadata(params({ line: '4.1', path: ['decorator', 'Command'] }))).toEqual(
      expected(
        'Command · meocord/decorator · MeoCord 4.1',
        'Decorator to register command methods in a controller.',
        '/docs/4.1/api/decorator/Command',
      ),
    )
  })

  it('an exact version’s API symbol: never indexed, canonical at the line’s page', async () => {
    const meta = await api.generateMetadata(params({ line: '4.1', path: ['4.1.0-beta.1', 'decorator', 'Command'] }))
    expect(meta).toEqual({
      ...expected(
        'Command · meocord/decorator 4.1.0-beta.1 · MeoCord 4.1',
        'Decorator to register command methods in a controller.',
        '/docs/4.1/api/decorator/Command',
      ),
    })
  })

  it("a changelog, a release's page and a migration guide", async () => {
    expect(await changelog.generateMetadata(params({ line: '4.1' }))).toEqual(
      expected(
        'Changelog · MeoCord 4.1',
        'The newest MeoCord 4.1 release in full, and every earlier one with its day and what it holds.',
        '/docs/4.1/changelog',
      ),
    )
    expect(await release.generateMetadata(params({ line: '4.1', version: '4.1.0-beta.1' }))).toEqual(
      expected(
        '4.1.0-beta.1 changelog · MeoCord 4.1',
        'What changed in MeoCord 4.1.0-beta.1: 1 minor change and 2 patch changes.',
        '/docs/4.1/changelog/4.1.0-beta.1',
      ),
    )
    expect(await release.generateMetadata(params({ line: '4.1', version: '4.0.0' }))).toEqual({})
    expect(await migrating.generateMetadata(params({ line: '4.1' }))).toEqual(
      expected(
        'Migrating · MeoCord 4.1',
        'Upgrading a bot to MeoCord 4.1: what changed, and what to do about it.',
        '/docs/4.1/migrating',
      ),
    )
  })

  it('a page missing from a line: noindex, with no canonical', async () => {
    expect(await missing.generateMetadata(params({ line: '4.0', id: 'quick-start' }))).toEqual(
      expected(
        'A first command (not documented) · MeoCord 4.0',
        'A first command is not documented for MeoCord 4.0. See where it is, and what 4.0 documents.',
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

  it('indexes a page unless it asks not to be, and follows its links either way', async () => {
    vi.stubEnv('SITE_INDEXABLE', 'true')
    vi.resetModules()
    const { pageMetadata } = await import('@/lib/docs/page-metadata')
    expect(pageMetadata({ title: 'Guards', line: '4.1', description: 'x' }).robots).toEqual({
      index: true,
      follow: true,
    })
    expect(pageMetadata({ title: 'Old', line: '4.1', description: 'x', index: false }).robots).toEqual({
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
