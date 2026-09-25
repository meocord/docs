import { expect, test } from '@playwright/test'

test('a guide renders in the window, at its canonical latest URL', async ({ page }) => {
  const response = await page.goto('/docs/latest/testing')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Testing' })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/docs\/latest\/testing$/)
  await expect(page.getByText(/^From the README of meocord \d/)).toBeVisible()
})

test('the sidebar lists the line’s pages and marks the one being read', async ({ page }) => {
  await page.goto('/docs/latest/guards')
  const nav = page.getByRole('navigation', { name: 'Documentation' })
  await expect(nav.getByRole('link')).not.toHaveCount(0)
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Guards')
  await nav.getByRole('link', { name: 'Testing' }).click()
  await expect(page).toHaveURL(/\/docs\/latest\/testing$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Testing' })).toBeVisible()
})

test('the table of contents links to the page’s headings', async ({ page }) => {
  await page.goto('/docs/latest/testing')
  const toc = page.getByRole('navigation', { name: 'On this page' })
  const first = toc.getByRole('link').first()
  const target = (await first.getAttribute('href'))!.slice(1)
  await expect(page.locator(`[id="${target}"]`)).toHaveCount(1)
})

test('the version switcher keeps the page when the other line has it', async ({ page }) => {
  await page.goto('/docs/latest/guards')
  await page.getByRole('button', { name: /^Documentation version/ }).click()
  await page.getByRole('menuitem', { name: /4\.1/ }).click()
  await expect(page).toHaveURL(/\/docs\/4\.1\/guards$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Guards' })).toBeVisible()
})

test('a line lands on its first page, and an unknown page is a 404', async ({ page, request }) => {
  const landing = await page.goto('/docs/4.1')
  expect(landing?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect((await request.get('/docs/latest/no-such-page')).status()).toBe(404)
})

test('the home page links into the current line', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Read the guides' }).click()
  await expect(page).toHaveURL(/\/docs\/latest$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
