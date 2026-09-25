import { expect, type Page, test } from '@playwright/test'

const GUTTER = 8

const sheetTop = (page: Page) => page.locator('[data-sheet]:visible').evaluate(sheet => sheet.scrollTop)

test.describe('on a desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('the sheet scrolls under its toolbar while the window stays put', async ({ page }) => {
    await page.goto('/docs/4.1/guards')
    const toolbar = page.locator('[data-sheet]:visible header').first()
    // Its hairline shows only once the page has scrolled beneath it.
    await expect(toolbar).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')
    await page.mouse.move(800, 500)
    await page.mouse.wheel(0, 1200)
    await expect.poll(() => sheetTop(page)).toBeGreaterThan(600)

    // The document never scrolls; the toolbar keeps the window's inset and its rounded corners.
    expect(await page.evaluate(() => [window.scrollY, document.documentElement.scrollHeight - innerHeight])).toEqual([
      0, 0,
    ])
    expect((await toolbar.boundingBox())?.y).toBe(GUTTER)
    await expect(toolbar).not.toHaveCSS('border-top-left-radius', '0px')
    await expect(toolbar).not.toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')
  })

  test('the sidebar scrolls on its own', async ({ page }) => {
    await page.goto('/docs/4.1/guards')
    const sidebar = page.locator('aside').first()
    await page.mouse.move(140, 500)
    await page.mouse.wheel(0, 400)
    await expect.poll(() => sidebar.evaluate(pane => pane.scrollTop)).toBeGreaterThan(0)
    expect(await sheetTop(page)).toBe(0)
  })

  test('the page keys scroll the sheet', async ({ page }) => {
    await page.goto('/docs/4.1/guards')
    await page.keyboard.press('PageDown')
    await expect.poll(() => sheetTop(page)).toBeGreaterThan(400)
    await page.keyboard.press('End')
    await expect
      .poll(() => page.locator('[data-sheet]:visible').evaluate(s => s.scrollHeight - s.clientHeight - s.scrollTop))
      .toBeLessThan(2)
  })

  test('an anchor lands below the toolbar', async ({ page }) => {
    await page.goto('/docs/4.1/guards#testing')
    const heading = page.locator('[id="testing"]')
    await expect.poll(() => sheetTop(page)).toBeGreaterThan(0)
    const top = (await heading.boundingBox())!.y
    expect(top).toBeGreaterThanOrEqual(GUTTER + 52)
    expect(top).toBeLessThan(200)
  })

  test('a new page opens at its top, and going back returns to where the sheet was', async ({ page }) => {
    await page.goto('/docs/4.1/guards')
    await page.mouse.move(800, 500)
    await page.mouse.wheel(0, 900)
    await expect.poll(() => sheetTop(page)).toBeGreaterThan(600)
    const left = await sheetTop(page)

    await page.locator('aside').getByRole('link', { name: 'Interceptors' }).click()
    await expect(page).toHaveURL(/\/interceptors$/)
    await expect.poll(() => sheetTop(page)).toBe(0)

    await page.goBack()
    await expect(page).toHaveURL(/\/guards$/)
    await expect.poll(() => sheetTop(page)).toBe(left)
  })
})

test('on a phone the document scrolls, with the toolbar at the top', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/docs/4.1/guards')
  await page.mouse.move(200, 400)
  await page.mouse.wheel(0, 900)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(600)
  expect((await page.locator('[data-sheet]:visible header').first().boundingBox())?.y).toBe(0)
})
