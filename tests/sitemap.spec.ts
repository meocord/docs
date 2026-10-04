import type { Metadata } from 'next'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

interface PageModule {
  default: (props: { params: Promise<object> }) => unknown
  generateStaticParams?: () => object[]
  generateMetadata?: (props: { params: Promise<object> }) => Promise<Metadata>
  metadata?: Metadata
}

// The root layout loads its fonts through Next's compiler; its metadata is all this reads
vi.mock('next/font/local', () => ({ default: () => ({ className: '', variable: '', style: {} }) }))
// Pages cache their render with cacheLife, which only Next's runtime allows; here they render uncached
vi.mock('next/cache', () => ({ cacheLife: () => {} }))

// Every page the app has, found by its file, so a new kind of page cannot be left out
const PAGES = import.meta.glob('/src/app/**/page.ts') as Record<string, () => Promise<PageModule>>

interface Prerendered {
  file: string
  params: object
  page: PageModule
  meta: Metadata
}

/** Whether rendering a page answers with a redirect or a 404, as Next signals them, rather than a page. */
async function answersElsewhere(page: PageModule, params: object): Promise<boolean> {
  try {
    await page.default({ params: Promise.resolve(params) })
    return false
  } catch (error) {
    const digest = String((error as { digest?: unknown }).digest ?? '')
    return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;404')
  }
}

describe('once the site is indexable', () => {
  const prerendered: Prerendered[] = []

  // The metadata of every page the build prerenders, exact versions' included, which takes a while
  beforeAll(async () => {
    vi.stubEnv('SITE_INDEXABLE', 'true')
    vi.resetModules()
    for (const [file, load] of Object.entries(PAGES)) {
      const page = await load()
      for (const params of page.generateStaticParams?.() ?? [{}]) {
        const meta = page.generateMetadata
          ? await page.generateMetadata({ params: Promise.resolve(params) })
          : (page.metadata ?? {})
        prerendered.push({ file, params, page, meta })
      }
    }
  }, 60_000)
  afterAll(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  // pageMetadata always decides robots; a docs page without it would be indexed or not by the layout's default
  it('every docs page declares its own metadata, unless it answers with a redirect or a 404', async () => {
    const undeclared = prerendered.filter(({ file, meta }) => file.includes('/docs/') && meta.robots === undefined)
    const pages: string[] = []
    for (const { file, params, page } of undeclared)
      if (!(await answersElsewhere(page, params))) pages.push(`${file} ${JSON.stringify(params)}`)
    expect(pages).toEqual([])
  })

  // Each page's own metadata decides whether it is indexed and where; the sitemap must agree
  it('the sitemap lists the canonical URL of every page search engines may index, and nothing else', async () => {
    const { metadata: layout } = await import('@/app/layout')
    const indexable = new Set<string>()
    for (const { file, params, meta } of prerendered) {
      const robots = meta.robots ?? layout.robots
      if (typeof robots !== 'object' || !robots?.index) continue
      const canonical = meta.alternates?.canonical
      expect(canonical, `${file} ${JSON.stringify(params)}: indexed without a canonical`).toEqual(expect.any(String))
      indexable.add(String(canonical))
    }

    const { GET } = await import('@/app/sitemap.xml/route')
    const { SITE_URL } = await import('@/config/site')
    const listed = [...(await GET().text()).matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, loc]) =>
      loc.replace(SITE_URL, ''),
    )
    expect(new Set(listed).size, 'a URL listed twice').toBe(listed.length)
    expect(listed.sort()).toEqual([...indexable].sort())

    // Each listed URL is the one its page answers at, so the proxy redirects none of them
    const { canonicalDocsPath } = await import('@/lib/urls')
    const { VERSIONS } = await import('@/config/versions')
    for (const url of listed) expect(canonicalDocsPath(url, VERSIONS), url).toBe(url)
  })
})
