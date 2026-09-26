import { readFileSync } from 'node:fs'
import { type APIResponse, expect, type Page, test } from '@playwright/test'
import type { SearchManifest } from '../src/lib/search-manifest'

const manifest = JSON.parse(readFileSync('.search/manifest.json', 'utf8')) as SearchManifest

/** The most a response's headers may take: under the 4 KB a reverse proxy buffers by default. */
const HEADER_BUDGET = 4096

/** A response's header block as sent: each `name: value` line, and the blank line after them. */
const headerBytes = (response: APIResponse) =>
  response.headersArray().reduce((total, { name, value }) => total + name.length + value.length + 4, 2)

/** Every page type, and every API page search can open, up to 40 a line. */
async function pages(request: import('@playwright/test').APIRequestContext): Promise<string[]> {
  const found = [
    '/',
    '/docs/latest/guards',
    '/docs/4.1/changelog',
    '/docs/4.1/changelog/4.1.0-beta.0',
    '/docs/4.1/migrating',
    '/docs/4.0/missing/interceptors',
  ]
  for (const line of manifest.lines) {
    const palette = (await (await request.get(line.palette)).json()) as { kind: string; url: string }[]
    found.push(
      ...palette
        .filter(entry => entry.kind !== 'guide')
        .slice(0, 40)
        .map(entry => entry.url),
    )
  }
  return found
}

/** The policy violations a page reports, recorded from before its first script runs. */
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __violations: string[] }).__violations = seen
    document.addEventListener('securitypolicyviolation', event => seen.push(event.violatedDirective))
  })
  return () => page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)
}

test('every page’s headers fit a reverse proxy’s buffer, however many scripts it has', async ({ request }) => {
  const over: string[] = []
  for (const path of await pages(request)) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    const bytes = headerBytes(response)
    if (bytes > HEADER_BUDGET) over.push(`${path}: ${bytes} bytes`)
  }
  expect(over).toEqual([])
})

test('the largest API page runs its scripts under its policy, with none refused', async ({ page, request }) => {
  let largest = { path: '', size: 0 }
  for (const path of (await pages(request)).filter(path => path.includes('/api/'))) {
    const size = (await (await request.get(path)).body()).length
    if (size > largest.size) largest = { path, size }
  }
  const violations = await recordViolations(page)
  const response = await page.goto(largest.path)
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  // Hydrated, so its inline scripts ran: the palette's trigger answers.
  await page.locator('[data-search-trigger]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await violations()).toEqual([])
})

test('an inline script the page did not send is refused and reported', async ({ page }) => {
  const violations = await recordViolations(page)
  await page.goto('/docs/latest/guards')
  const ran = await page.evaluate(async () => {
    const script = document.createElement('script')
    script.textContent = 'window.__injected = true'
    document.head.append(script)
    await new Promise(resolve => setTimeout(resolve, 50))
    return (window as unknown as { __injected?: boolean }).__injected === true
  })
  expect(ran).toBe(false)
  expect(await violations()).toContain('script-src-elem')
})
