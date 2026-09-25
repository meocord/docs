import { expect, test } from '@playwright/test'

test('an address the site does not have opens the docs window, with ways back in', async ({ page }) => {
  const response = await page.goto('/docs/4.1/no-such-page')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page.locator('aside nav')).toBeVisible()
  await page.getByRole('button', { name: 'Search the docs' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('on a phone the toolbar names only the current page, without overlap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/docs/4.1/api/decorator/Command')
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' }).locator('li')
  const shown = await crumbs.evaluateAll(items =>
    items.filter(item => item.checkVisibility()).map(item => (item as HTMLElement).innerText),
  )
  expect(shown).toEqual(['Command'])
})

test('an API parameter’s name and type never break inside a word', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/docs/4.1/api/decorator/Command')
    const lines = await page
      .locator('[data-params] td:first-child code, [data-params] td:nth-child(2) code')
      .evaluateAll(codes => codes.map(code => code.getClientRects().length))
    expect(lines.every(count => count === 1)).toBe(true)
  }
})

test('an API return type is framed as its signature is', async ({ page }) => {
  await page.goto('/docs/4.1/api/decorator/Command')
  await expect(page.locator('h2#returns + pre[data-signature]')).toBeVisible()
})

test('a changelog groups its entries under labels, below the version headings', async ({ page }) => {
  await page.goto('/docs/4.1/changelog')
  const label = page.locator('h3[data-group]').first()
  await expect(label).toHaveCSS('text-transform', 'uppercase')
  const [version, group] = await Promise.all([
    page
      .locator('h2')
      .nth(0)
      .evaluate(h => parseFloat(getComputedStyle(h).fontSize)),
    label.evaluate(h => parseFloat(getComputedStyle(h).fontSize)),
  ])
  expect(group).toBeLessThan(version / 2)
})
