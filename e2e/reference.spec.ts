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
  expect((await request.get('/docs/4.1/missing/interceptors')).status()).toBe(404)
})
