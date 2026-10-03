import { readFileSync } from 'node:fs'
import { type Page } from '@playwright/test'
import { expect, test } from './test'

// The line versions.json makes current, which the site addresses as latest
const VERSIONS = JSON.parse(readFileSync('versions.json', 'utf8')) as {
  lines: { line: string; status: string; versions: string[] }[]
}
const CURRENT = VERSIONS.lines.find(entry => entry.status === 'current')!.line

const sidebarBody = (page: Page) => page.locator('[data-sidebar-body]:visible')
const top = (page: Page) => sidebarBody(page).evaluate(body => body.scrollTop)

// Short enough that every line's sidebar scrolls
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 480 })
})

test("the current line's number URL is sent to its latest URL, and a line-bound page keeps its own", async ({
  request,
}) => {
  const line = await request.get(`/docs/${CURRENT}`, { maxRedirects: 0 })
  expect(line.status()).toBe(307)
  expect(new URL(line.headers()['location'], 'http://site').pathname).toBe('/docs/latest')

  const missing = await request.get(`/docs/${CURRENT}/missing/no-such-page`, { maxRedirects: 0 })
  expect(missing.status()).not.toBe(307)

  // A latest URL whose target depends on the current line moves its reader only temporarily
  const moved = await request.get('/docs/latest/missing/coming-from-discordjs', { maxRedirects: 0 })
  expect(moved.status()).toBe(307)
})

test("opened at the current line's number URL, the sidebar keeps its place as the reader moves on", async ({
  page,
}) => {
  // A page of the current line, opened by its number rather than latest
  await page.goto('/docs/latest')
  const first = await sidebarBody(page).locator('a[href^="/docs/latest/"]').first().getAttribute('href')
  await page.goto(first!.replace('/docs/latest/', `/docs/${CURRENT}/`))
  await expect(page).toHaveURL(new RegExp(`${first}$`))

  // Scrolled a little, with a link still in view to follow
  await sidebarBody(page).evaluate(body => (body.scrollTop = Math.min(160, body.scrollHeight - body.clientHeight)))
  const left = await top(page)
  expect(left).toBeGreaterThan(0)
  const next = await page.evaluate(() => {
    const body = [...document.querySelectorAll('[data-sidebar-body]')].find(element => element.checkVisibility())!
    const view = body.getBoundingClientRect()
    return [...body.querySelectorAll<HTMLAnchorElement>('a[href^="/docs/latest/"]:not([aria-current])')]
      .find(link => {
        const box = link.getBoundingClientRect()
        return box.top > view.top + 80 && box.bottom < view.bottom - 40
      })!
      .getAttribute('href')!
  })

  await sidebarBody(page).locator(`a[href="${next}"]`).click()
  await expect(page).toHaveURL(new RegExp(`${next}$`))
  await expect.poll(() => top(page)).toBe(left)
})

test("a line-bound page at the current line's number and a latest page keep one sidebar place", async ({ page }) => {
  // An exact version's API page answers at the line's number, as the newest release's copy of a line's API page
  const newest = VERSIONS.lines.find(entry => entry.line === CURRENT)!.versions.at(-1)!
  await page.goto('/docs/latest/api/core/MeoCordFactory')
  const symbol = new URL(page.url()).pathname
  const exact = symbol.replace('/docs/latest/api/', `/docs/${CURRENT}/api/${newest}/`)
  await page.goto(exact)
  await expect(page).toHaveURL(new RegExp(`${exact}$`))

  // Scrolled a little, then a sidebar link to a page of the line at latest, brought into view if it isn't, followed
  await sidebarBody(page).evaluate(body => (body.scrollTop = Math.min(160, body.scrollHeight - body.clientHeight)))
  const link = sidebarBody(page).locator('a[href^="/docs/latest/"]').last()
  await link.scrollIntoViewIfNeeded()
  // A link at the very top, as a by-kind API's Guide and API tabs are: scrolled just short of hiding it
  if ((await top(page)) === 0) await sidebarBody(page).evaluate(body => (body.scrollTop = 4))
  const left = await top(page)
  expect(left).toBeGreaterThan(0)
  const href = (await link.getAttribute('href'))!
  // Followed as the page's own link, without the scroll into view a pointer click makes
  await link.evaluate(anchor => (anchor as HTMLAnchorElement).click())
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  // The line's place, as far as the new page's sidebar scrolls, rather than its top
  const furthest = await sidebarBody(page).evaluate(body => body.scrollHeight - body.clientHeight)
  await expect.poll(() => top(page)).toBe(Math.min(left, furthest))
})
