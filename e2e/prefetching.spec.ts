import { type Locator, type Page, type Request } from '@playwright/test'
import { cacheControlFor } from '../src/lib/cache-policy'
import { expect, test } from './test'
import { docs41, docsCurrent, literal } from './lines'

/** How long the network stays free of new prefetches before a page counts as done prefetching. */
const QUIET_MS = 1500
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
      prefetch: headers['next-router-prefetch'] === '1',
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

/** Prefetch requests and their response bytes, as a figure for the run's annotations. */
async function traffic(fetches: Fetch[]): Promise<string> {
  const prefetches = fetches.filter(fetch => fetch.prefetch)
  const sizes = await Promise.all(
    prefetches.map(async ({ request }) => ((await request.response()) ? (await request.sizes()).responseBodySize : 0)),
  )
  const bytes = sizes.reduce((sum, size) => sum + size, 0)
  const paths = new Set(prefetches.map(fetch => fetch.pathname)).size
  return `${prefetches.length} prefetches for ${paths} paths, ${(bytes / 1024).toFixed(1)} KB`
}

function report(name: string, description: string): void {
  test.info().annotations.push({ type: 'prefetching', description: `${name}: ${description}` })
  console.log(`[prefetching] ${name}: ${description}`)
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

/** Clicks a link and fails on any request for its page made after the click, reporting what it saw. */
async function clickAndCount(page: Page, fetches: Fetch[], name: string, target: Locator): Promise<void> {
  const href = await target.getAttribute('href')
  expect(href, `${name} has a target`).toBeTruthy()
  const destination = new URL(href!, page.url()).pathname
  const prefetched = fetches.some(fetch => fetch.prefetch && fetch.pathname === destination)

  const before = fetches.length
  // Every request the click causes, beyond the build's own static files, to show what the counter above misses
  const caused: string[] = []
  const onRequest = (request: Request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/_next/static/')) return
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
  const after = fetches.slice(before).filter(fetch => !fetch.prefetch && fetch.pathname === destination)
  report(name, `requests the click caused: ${caused.join(', ') || 'none'}`)
  report(name, `${destination} prefetched ${prefetched}; ${after.length} request(s) on the click; h1 in ${elapsed} ms`)

  expect(
    after.map(fetch => fetch.request.url()),
    `requests for ${destination} after the click`,
  ).toEqual([])
}

test.describe('on a desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  for (const path of TRAFFIC_PAGES) {
    test(`${path} prefetches with the headers a shared cache needs`, async ({ page }) => {
      const fetches = recordRsc(page)
      await page.goto(path)
      await settle(page, fetches)
      const loaded = await traffic(fetches)
      await scrollThrough(sheet(page))
      await scrollThrough(sidebarBody(page))
      await settle(page, fetches)
      report(path, `after load ${loaded}; after scrolling ${await traffic(fetches)}`)

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

  test('the sidebar link to a page it prefetched opens it without a request', async ({ page }) => {
    const fetches = recordRsc(page)
    await page.goto(`${docs41}/guards`)
    await settle(page, fetches)
    const inView = await sidebarLinksInView(page)
    const prefetched = new Set(fetches.filter(fetch => fetch.prefetch).map(fetch => fetch.pathname))
    const ready = inView.filter(href => prefetched.has(new URL(href, page.url()).pathname))
    const missed = inView.filter(href => !ready.includes(href))
    report(
      'sidebar',
      `${inView.length} links in view, ${ready.length} prefetched; not prefetched: ${missed.join(', ')}`,
    )
    // A link Next has prefetched where there is one; otherwise the first in view, which shows a click's cost
    const href = ready[0] ?? inView[0]
    expect(href, 'a sidebar link in view').toBeTruthy()
    await clickAndCount(page, fetches, 'a sidebar link', sidebarBody(page).locator(`a[href="${href}"]`))
  })

  test('the next-page link to a page it prefetched opens it without a request', async ({ page }) => {
    const fetches = recordRsc(page)
    await page.goto(`${docs41}/guards`)
    await scrollThrough(sheet(page))
    await settle(page, fetches)
    await clickAndCount(page, fetches, 'the next-page link', page.locator('[data-pager] a[rel="next"]:visible'))
  })
  test('going back after a page that was fetched on the click returns to where the sheet was', async ({ page }) => {
    // No prefetch reaches the server, so the next page comes from a request made on the click
    await page.route('**/*', route =>
      route.request().headers()['next-router-prefetch'] === '1' ? route.abort() : route.fallback(),
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

    await page.goBack()
    await expect(page).toHaveURL(/\/guards$/)
    await expect.poll(() => sheetTop(page)).toBe(left)
  })
})
