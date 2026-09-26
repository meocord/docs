import { expect, test } from '@playwright/test'

test('an address the site does not have opens the docs window without its sidebar, with ways back in', async ({
  page,
}) => {
  const response = await page.goto('/docs/4.1/no-such-page')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  // Every page's data carries this page, so it draws no sidebar; the toolbar leads home instead
  await expect(page.locator('aside nav')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'MeoCord home' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'documentation' })).toHaveAttribute('href', '/docs/latest')
  await page.getByRole('button', { name: 'Search the docs' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('every way of reaching a missing page answers 404 with the same page', async ({ request }) => {
  for (const path of [
    '/no-such-page',
    '/docs/latest/no-such-page',
    '/docs/4.1/api/core/NoSuchSymbol',
    '/docs/4.0/missing/no-such-page',
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    expect(await response.text(), path).toContain('Page not found')
  }
})

for (const [label, width] of [
  ['a phone', 390],
  ['a desktop', 1440],
] as const) {
  test(`on ${label} the missing page's toolbar keeps every control on one row, with no menu`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/no-such-page')
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0)
    const home = page.getByRole('link', { name: 'MeoCord home' })
    await expect(home).toBeVisible()
    const crumb = page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Not found')
    // One row: the mark and the crumb share a line, and the crumb is not cut short
    const [a, b] = [await home.boundingBox(), await crumb.boundingBox()]
    expect(Math.abs(a!.y + a!.height / 2 - (b!.y + b!.height / 2))).toBeLessThan(4)
    expect(await crumb.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  })
}

test('on a wide window the missing page is centred, with its footer rule under the column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/no-such-page')
  const box = await page.evaluate(() => {
    // The sheet's content box: the grid inside its scrollbar gutter
    const sheet = document.querySelector('main')!.parentElement!.getBoundingClientRect()
    const column = document.querySelector('main')!.getBoundingClientRect()
    const rule = document.querySelector('main footer')!.getBoundingClientRect()
    return {
      left: column.left - sheet.left,
      right: sheet.right - column.right,
      ruleLeft: rule.left,
      ruleRight: rule.right,
      column,
    }
  })
  expect(Math.abs(box.left - box.right)).toBeLessThan(2)
  expect(Math.abs(box.ruleLeft - box.column.left)).toBeLessThan(2)
  expect(Math.abs(box.ruleRight - box.column.right)).toBeLessThan(2)
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

test('an API return type is framed as its signature is, after what it returns', async ({ page }) => {
  await page.goto('/docs/4.1/api/decorator/Command')
  await expect(page.locator('h2#returns + p')).toHaveText('Returns a method decorator.')
  await expect(page.locator('h2#returns + p + pre[data-signature]')).toBeVisible()
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
