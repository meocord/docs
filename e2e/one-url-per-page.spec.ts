import { readFileSync } from 'node:fs'
import { type Page } from '@playwright/test'
import { expect, test } from './test'

// The line versions.json makes current, which the site addresses as latest
const VERSIONS = JSON.parse(readFileSync('versions.json', 'utf8')) as { lines: { line: string; status: string }[] }
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
