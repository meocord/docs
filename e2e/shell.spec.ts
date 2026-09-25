import { expect, test } from '@playwright/test'

test('the first Tab reaches the skip link, which leads to the content', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('#content')).toBeFocused()
})

test('the sidebar marks the page being read', async ({ page }) => {
  await page.goto('/')
  const current = page.getByRole('navigation', { name: 'Documentation' }).locator('[aria-current="page"]')
  await expect(current).toHaveText('Overview')
})

test('the version menu opens on the current line, moves by arrow keys and hands focus back', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: /^Documentation version/ })
  await trigger.click()

  const menu = page.getByRole('menu', { name: 'Documentation version' })
  await expect(menu).toBeVisible()
  const items = menu.getByRole('menuitem')
  await expect(items).toHaveCount(2)
  await expect(items.first()).toBeFocused()
  await expect(items.first()).toHaveAttribute('aria-current', 'page')

  await page.keyboard.press('ArrowDown')
  await expect(items.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(items.first()).toBeFocused()
  await page.keyboard.press('End')
  await expect(items.nth(1)).toHaveAttribute('href', '/docs/next')

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('a press outside the version menu closes it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Documentation version/ }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.mouse.click(400, 400)
  await expect(page.getByRole('menu')).toBeHidden()
})

test('the theme control switches the mode and shows the choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'dark')

  const light = page.getByRole('button', { name: 'Light' })
  await light.click()
  await expect(html).toHaveAttribute('data-theme', 'light')
  await expect(light).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Match the system' })).toHaveAttribute('aria-pressed', 'false')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the page fits the width, and the sidebar is a sheet opened from the toolbar', async ({ page }) => {
    await page.goto('/')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeHidden()

    const open = page.getByRole('button', { name: 'Open navigation' })
    await open.click()
    const sheet = page.getByRole('dialog', { name: 'Documentation' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('link', { name: 'Overview' })).toBeFocused()

    // Focus stays inside the sheet.
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
    expect(await sheet.evaluate(node => node.contains(document.activeElement))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(open).toBeFocused()
  })
})
