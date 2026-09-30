import { expect, test } from '@playwright/test'
import manifest from '../versions.json'

// The 4.1 line's releases, newest last, so the changelog's checks follow each sync.
const releases = manifest.lines.find(entry => entry.line === '4.1')?.versions ?? []
const [previous, newest] = releases.slice(-2)

test('the changelog sums up the newest release and links every release to its notes, marking itself in the sidebar', async ({
  page,
}) => {
  const response = await page.goto('/docs/4.1/changelog')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Changelog for 4.1')
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(newest)
  await expect(page.locator('h3[data-group]').first()).toBeVisible()
  const earlier = page.locator('ul[data-releases] li')
  await expect(earlier.first()).toContainText(
    new RegExp(`${previous.replaceAll('.', '\\.')} · \\d+ \\w+ \\d{4} · \\d+ \\w+ changes?`),
  )
  await expect(page.getByRole('link', { name: 'Changelog', exact: true })).toHaveAttribute('aria-current', 'page')

  // The newest release's notes in full are on its own page, not on the index.
  const notes = page.locator('a[data-release-notes]')
  await expect(notes).toHaveText(`The ${newest} notes in full`)
  await expect(notes).toHaveAttribute('href', new RegExp(`/changelog/${newest.replaceAll('.', '\\.')}$`))

  // An earlier release opens on its own page, its groups at their anchors, under the changelog in the crumbs.
  await page.getByRole('link', { name: '4.1.0-beta.0', exact: true }).click()
  await expect(page).toHaveURL(/\/docs\/4\.1\/changelog\/4\.1\.0-beta\.0$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('4.1.0-beta.0 changelog')
  await expect(page.locator('h2#minor-changes')).toBeVisible()
  await expect(page.locator('time[datetime="2026-09-24"]')).toHaveText('24 September 2026')
  await expect(
    page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Changelog' }),
  ).toHaveAttribute('href', '/docs/4.1/changelog')
})

test('a release no line has answers 404, and a line reaches its releases through latest too', async ({ request }) => {
  expect((await request.get('/docs/4.1/changelog/4.1.0-beta.99')).status()).toBe(404)
  expect((await request.get('/docs/4.1/changelog/4.0.0')).status()).toBe(404)
  expect((await request.get('/docs/latest/changelog/4.0.0')).status()).toBe(200)
})

test("a line's API reference opens on its index by kind, or on MeoCordFactory by entry point", async ({ request }) => {
  // 4.1 is arranged by kind: its API opens on the index of the kinds
  const index = await request.get('/docs/4.1/api', { maxRedirects: 0 })
  expect(index.status()).toBe(200)
  const html = await index.text()
  expect(html).toContain('<h1>API</h1>')
  // Each kind heads its section, linking its page, over the symbols it files, each linking its own
  expect(html).toContain('<a href="/docs/4.1/api/decorators">Decorators</a>')
  expect(html).toContain('<a href="/docs/4.1/api/decorators/Command">')
  expect(html).toContain('<a href="/docs/4.1/api/controllers/ShardContext">')
  // 4.0 is arranged by entry point, and opens where every app starts
  for (const [path, landing] of [
    ['/docs/4.0/api', '/docs/latest/api/core/MeoCordFactory'],
    ['/docs/latest/api', '/docs/latest/api/core/MeoCordFactory'],
  ]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(307)
    expect(response.headers().location, path).toBe(landing)
  }
  expect((await request.get('/docs/9.9/api')).status()).toBe(404)
})

test('the migration guide renders for each line that has one', async ({ request }) => {
  for (const path of ['/docs/4.1/migrating', '/docs/latest/migrating']) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
})

test('switching to a line without the page lands on a page saying so', async ({ page }) => {
  await page.goto('/docs/4.1/interceptors')
  const versions = page.getByRole('button', { name: /4\.1/ }).first()
  await versions.click()
  await page.getByRole('menuitem', { name: /4\.0/ }).first().click()
  await expect(page).toHaveURL(/\/docs\/4\.0\/missing\/interceptors$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Not in 4.0')
  await expect(page.getByRole('link', { name: 'Interceptors in 4.1' })).toHaveAttribute(
    'href',
    '/docs/4.1/interceptors',
  )
})

test('a missing page is noindexed, and one for a page no line has is a 404', async ({ request }) => {
  const html = await (await request.get('/docs/4.0/missing/interceptors')).text()
  // Noindex always; its links are followed once the site is indexable, which this build is not.
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>')
  expect((await request.get('/docs/4.0/missing/no-such-page')).status()).toBe(404)
  // A line that has the page sends the reader to it, rather than saying it lacks it
  const present = await request.get('/docs/4.1/missing/interceptors', { maxRedirects: 0 })
  expect(present.status()).toBe(308)
  expect(present.headers().location).toBe('/docs/4.1/interceptors')
})
