import { expect, test } from '@playwright/test'

test('the changelog lists each version at its anchor, and marks itself in the sidebar', async ({ page }) => {
  const response = await page.goto('/docs/4.1/changelog')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Changelog for 4.1')
  await expect(page.locator('h2#v4\\.1\\.0-beta\\.0')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Changelog', exact: true })).toHaveAttribute('aria-current', 'page')
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
  expect(html).toContain('<meta name="robots" content="noindex, follow"/>')
  expect((await request.get('/docs/4.0/missing/no-such-page')).status()).toBe(404)
  expect((await request.get('/docs/4.1/missing/interceptors')).status()).toBe(404)
})
