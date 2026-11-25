import { type Locator, type Page, type Request } from '@playwright/test'
import { cacheControlFor } from '../src/lib/cache-policy'
import { expect, test } from './test'
import { docs41, docsCurrent, literal } from './lines'

/** How long the network stays free of new prefetches before a page counts as done prefetching. */
const QUIET_MS = 1500
/**
 * The most a page may prefetch once loaded, uncompressed. A link prefetches its route's shared shell, 0.6–1.0 MB a
 * page here; prefetching each link's own page would come to 4–4.7 MB.
 */
const PREFETCH_LIMIT_KB = 2048
/** The pages whose prefetch traffic each run reports: a long guide, home and an API page. */
const TRAFFIC_PAGES = ['/', `${docsCurrent}/testing`, `${docs41}/api/controllers/ShardContext`]

const sheet = (page: Page) => page.locator('[data-sheet]:visible')
const sidebarBody = (page: Page) => page.locator('[data-sidebar-body]:visible')
const sheetTop = (page: Page) => sheet(page).evaluate(element => element.scrollTop)

interface Fetch {
  request: Request
  prefetch: boolean
  pathname: string
}

/** Every RSC request the page makes, a prefetch or a navigation's own, from the moment this is called. */
function recordRsc(page: Page): Fetch[] {
  const fetches: Fetch[] = []
  page.on('request', request => {
    const headers = request.headers()
    if (headers.rsc !== '1') return
    fetches.push({
      request,
      // Next sends values other than '1' for some kinds of prefetch
      prefetch: headers['next-router-prefetch'] !== undefined,
      pathname: new URL(request.url()).pathname,
    })
  })
  return fetches
}

/** Waits until no prefetch has started for QUIET_MS, so a count taken next is the page's whole traffic. */
async function settle(page: Page, fetches: Fetch[]): Promise<void> {
  await page.waitForLoadState('load')
  let seen = -1
  while (seen !== fetches.length) {
    seen = fetches.length
    await page.waitForTimeout(QUIET_MS)
  }
}

/** Scrolls an element to its end a viewport at a time, so each link in it enters the viewport on the way. */
async function scrollThrough(scroller: ReturnType<typeof sheet>): Promise<void> {
  if ((await scroller.count()) === 0) return
  await scroller.evaluate(async element => {
    while (element.scrollTop + element.clientHeight < element.scrollHeight - 1) {
      element.scrollTop += element.clientHeight
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  })
}

interface Traffic {
  prefetches: number
  paths: number
  kilobytes: number
}

/** Prefetch requests so far, the paths they cover and their response bytes. */
async function traffic(fetches: Fetch[]): Promise<Traffic> {
  const prefetches = fetches.filter(fetch => fetch.prefetch)
  const sizes = await Promise.all(
    prefetches.map(async ({ request }) => ((await request.response()) ? (await request.sizes()).responseBodySize : 0)),
  )
  const bytes = sizes.reduce((sum, size) => sum + size, 0)
  return {
    prefetches: prefetches.length,
    paths: new Set(prefetches.map(fetch => fetch.pathname)).size,
    kilobytes: bytes / 1024,
  }
}

const shown = ({ prefetches, paths, kilobytes }: Traffic) =>
  `${prefetches} prefetches for ${paths} paths, ${kilobytes.toFixed(1)} KB`

function report(name: string, description: string): void {
  test.info().annotations.push({ type: 'prefetching', description: `${name}: ${description}` })
  console.log(`[prefetching] ${name}: ${description}`)
}

/** The path of every link on the page that shows inside the viewport. */
function linksInView(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .filter(link => {
        const box = link.getBoundingClientRect()
        return (
          link.checkVisibility() && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
        )
      })
      .map(link => new URL(link.href).pathname),
  )
}

/** The `href` of each sidebar link wholly inside the sidebar's visible part, the current page's left out. */
function sidebarLinksInView(page: Page): Promise<string[]> {
  return sidebarBody(page).evaluate(body => {
    const view = body.getBoundingClientRect()
    return [...body.querySelectorAll<HTMLAnchorElement>('a[href]:not([aria-current="page"])')]
      .filter(link => {
        const box = link.getBoundingClientRect()
        return box.height > 0 && box.top >= view.top && box.bottom <= view.bottom
      })
      .map(link => link.getAttribute('href')!)
  })
}

/** What a click on a link cost: its page's RSC requests after the click, and any document the browser loaded. */
interface Click {
  destination: string
  requests: string[]
  documents: string[]
}

/** Clicks a link, waits for its page's h1 and reports the requests the click caused. */
async function clickAndCount(page: Page, fetches: Fetch[], name: string, target: Locator): Promise<Click> {
  const href = await target.getAttribute('href')
  expect(href, `${name} has a target`).toBeTruthy()
  const destination = new URL(href!, page.url()).pathname
  const prefetched = fetches.some(fetch => fetch.prefetch && fetch.pathname === destination)

  const before = fetches.length
  // Every request the click causes, beyond the build's own static files, to show what the counter above misses
  const caused: string[] = []
  const documents: string[] = []
  const onRequest = (request: Request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/_next/static/')) return
    // A link Next doesn't handle loads its page as a new document, which the RSC counter never sees
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(url.pathname)
    const headers = request.headers()
    const kind = headers['next-router-segment-prefetch']
      ? 'segment'
      : headers['next-router-prefetch']
        ? 'prefetch'
        : headers.rsc
          ? 'rsc'
          : request.resourceType()
    caused.push(`${kind} ${url.pathname}`)
  }
  page.on('request', onRequest)
  const started = Date.now()
  await target.click()
  await expect(page).toHaveURL(new RegExp(`${literal(destination)}$`))
  await expect(page.locator('h1:visible').first()).toBeVisible()
  const elapsed = Date.now() - started
  page.off('request', onRequest)
  const requests = fetches
    .slice(before)
    .filter(fetch => !fetch.prefetch && fetch.pathname === destination)
    .map(fetch => fetch.request.url())
  report(name, `requests the click caused: ${caused.join(', ') || 'none'}`)
  report(
    name,
    `${destination} prefetched ${prefetched}; ${requests.length} request(s) and ${documents.length} document(s) on the click; h1 in ${elapsed} ms`,
  )
  return { destination, requests, documents }
}

/**
 * Fails unless the click opened its page on the client with one request for it. A link prefetches only its route's
 * shared shell, so the page itself comes on the click.
 */
function expectOneRequest({ destination, requests, documents }: Click): void {
  expect(documents, `documents loaded for ${destination}`).toEqual([])
  expect(requests, `requests for ${destination} after the click`).toHaveLength(1)
}

test.describe('on a desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  for (const path of TRAFFIC_PAGES) {
    test(`${path} prefetches within its limit, with the headers a shared cache needs`, async ({ page }) => {
      const fetches = recordRsc(page)
      await page.goto(path)
      await settle(page, fetches)
      const loaded = await traffic(fetches)
      await scrollThrough(sheet(page))
      await scrollThrough(sidebarBody(page))
      await settle(page, fetches)
      report(path, `after load ${shown(loaded)}; after scrolling ${shown(await traffic(fetches))}`)
      // None at all would mean Next stopped prefetching, or this spec stopped seeing it
      expect(loaded.prefetches, `prefetches once ${path} loaded`).toBeGreaterThan(0)
      // Prefetching each link's own page would multiply this several times over
      expect(loaded.kilobytes, `KB prefetched once ${path} loaded`).toBeLessThan(PREFETCH_LIMIT_KB)

      // Each prefetch answers for its own request only, and is cached as the page it belongs to is
      for (const { request, pathname } of fetches.filter(fetch => fetch.prefetch)) {
        const response = await request.response()
        if (!response || response.status() !== 200) continue
        const headers = await response.allHeaders()
        const vary = (headers.vary ?? '').toLowerCase()
        expect(vary, `Vary of ${request.url()}`).toContain('rsc')
        expect(vary, `Vary of ${request.url()}`).toContain('next-router-prefetch')
        if ((await request.allHeaders())['next-router-segment-prefetch'] !== undefined) {
          expect(vary, `Vary of ${request.url()}`).toContain('next-router-segment-prefetch')
        }
        expect(headers['cache-control'], `Cache-Control of ${request.url()}`).toBe(cacheControlFor(pathname))
      }
    })
  }

  test('a page prefetches only for the links in view, and a sidebar link opens its page with one request', async ({
    page,
  }) => {
    const fetches = recordRsc(page)
    await page.goto(`${docs41}/guards`)
    await settle(page, fetches)
    const inView = new Set([...(await linksInView(page)), new URL(page.url()).pathname])
    const prefetched = [...new Set(fetches.filter(fetch => fetch.prefetch).map(fetch => fetch.pathname))]
    const sidebarLinks = await sidebarLinksInView(page)
    report('sidebar', `${sidebarLinks.length} links in view; prefetches for ${prefetched.length} paths`)
    expect(prefetched.length, 'paths prefetched').toBeGreaterThan(0)
    expect(
      prefetched.filter(path => !inView.has(path)),
      'paths prefetched with no link to them in view',
    ).toEqual([])

    const href = sidebarLinks[0]
    expect(href, 'a sidebar link in view').toBeTruthy()
    expectOneRequest(
      await clickAndCount(page, fetches, 'a sidebar link', sidebarBody(page).locator(`a[href="${href}"]`)),
    )
  })

  test('the next-page link opens its page with one request', async ({ page }) => {
    const fetches = recordRsc(page)
    await page.goto(`${docs41}/guards`)
    await scrollThrough(sheet(page))
    await settle(page, fetches)
    expectOneRequest(
      await clickAndCount(page, fetches, 'the next-page link', page.locator('[data-pager] a[rel="next"]:visible')),
    )
  })
  test('going back after a page that was fetched on the click returns to where the sheet was', async ({ page }) => {
    // No prefetch reaches the server, so the next page comes from a request made on the click
    await page.route('**/*', route =>
      route.request().headers()['next-router-prefetch'] !== undefined ? route.abort() : route.fallback(),
    )
    const fetches = recordRsc(page)
    await page.goto(`${docs41}/guards`)
    await page.mouse.move(800, 500)
    await page.mouse.wheel(0, 900)
    await expect.poll(() => sheetTop(page)).toBeGreaterThan(600)
    const left = await sheetTop(page)

    await sidebarBody(page).getByRole('link', { name: 'Interceptors', exact: true }).click()
    await expect(page).toHaveURL(/\/interceptors$/)
    await expect.poll(() => sheetTop(page)).toBe(0)
    const fetched = fetches.filter(fetch => !fetch.prefetch && fetch.pathname.endsWith('/interceptors')).length
    report('back after an unprefetched page', `${fetched} request(s) for the page on the click`)
    expect(fetched, 'requests for the page on the click').toBe(1)

    await page.goBack()
    await expect(page).toHaveURL(/\/guards$/)
    await expect.poll(() => sheetTop(page)).toBe(left)
  })
})
