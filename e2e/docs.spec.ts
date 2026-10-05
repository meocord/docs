import { expect, test } from '@playwright/test'
import { CURRENT_LINE, VERSIONS } from '../src/config/versions'
import { docs40, docs41, literal } from './lines'

test('a guide renders in the window, at its canonical latest URL', async ({ page }) => {
  const response = await page.goto('/docs/latest/testing')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Testing' })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/docs\/latest\/testing$/)
  await expect(page.locator('[data-subtitle]')).toHaveText(new RegExp(`^MeoCord ${literal(CURRENT_LINE)} · `))
  // 4.0's guides are its README's sections
  await page.goto(`${docs40}/testing`)
  await expect(page.locator('[data-subtitle]')).toHaveText(/^MeoCord 4\.0 · .*from the README of meocord 4\.0\./)
})

test('the sidebar lists the line’s pages and marks the one being read', async ({ page }) => {
  // In a Guide, the tab of the section read is current too, but only the page's own link is current as a page
  await page.goto(`${docs41}/guards`)
  const guide = page.getByRole('navigation', { name: 'Documentation' })
  await expect(guide.locator('[aria-current="page"]')).toHaveCount(1)
  await expect(guide.locator('[aria-current="page"]')).toHaveAttribute('href', `${docs41}/guards`)
  await expect(guide.locator('[data-nav-tabs] > a[aria-current="true"]')).toHaveText('Guide')

  await page.goto('/docs/latest/guards')
  const nav = page.getByRole('navigation', { name: 'Documentation' })
  await expect(nav.getByRole('link')).not.toHaveCount(0)
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Guards')
  // Each line's sidebar names the page its own way
  await nav.locator('a[href="/docs/latest/testing"]').click()
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
  await page.goto(`${docs40}/guards`)
  await page.getByRole('button', { name: /^Documentation version/ }).click()
  await page.getByRole('menuitem', { name: /4\.1/ }).click()
  await expect(page).toHaveURL(new RegExp(`${literal(docs41)}/guards$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Guards' })).toBeVisible()
})

test('a line lands on its first page, and an unknown page is a 404', async ({ page, request }) => {
  const landing = await page.goto('/docs/4.1')
  expect(landing?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect((await request.get('/docs/latest/no-such-page')).status()).toBe(404)
})

test('the home page links into the guides of the line it shows', async ({ page }) => {
  await page.goto('/')
  // The Learn door opens the Guide where a reader starts, the first command after the setup
  await page.locator('[data-door]').first().getByRole('link', { name: 'Your first command' }).click()
  await expect(page).toHaveURL(new RegExp(`${literal(docs41)}/first-command$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Your first command' })).toBeVisible()
})

test('a page of an archived line says it is no longer supported, and links the supported line', async ({
  page,
  request,
}) => {
  const archived = VERSIONS.lines.find(entry => entry.status === 'archived')
  test.skip(!archived, 'no line is archived')
  await page.goto(`/docs/${archived!.line}/testing`)
  const notice = page.getByRole('complementary', { name: `MeoCord ${archived!.line} is no longer supported` })
  await expect(notice).toContainText('security fixes included')
  for (const name of [`Read this page for ${CURRENT_LINE}`, 'upgrade guide']) {
    const href = await notice.getByRole('link', { name }).getAttribute('href')
    expect((await request.get(href!)).status(), name).toBe(200)
  }

  await page.goto('/docs/latest/testing')
  await expect(page.locator('[data-archived-notice]')).toHaveCount(0)
})
