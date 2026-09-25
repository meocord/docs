import { expect, test, type Page } from '@playwright/test'

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
  await page.goto('/docs/latest/overview')
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
  await expect(items.nth(1)).toBeFocused()
  // Each line links to where it lands, the current one at its alias.
  await expect(items.first()).toHaveAttribute('href', '/docs/latest')
  await expect(items.nth(1)).toHaveAttribute('href', '/docs/4.1')

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
    await page.goto('/docs/latest/overview')
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

test.describe('the mark in the sidebar', () => {
  // The visible ears path: the plain crown, or the crown with the inner ears cut out.
  const visibleEars = (page: Page) =>
    page
      .locator('aside a[href="/"] svg path[fill-rule="evenodd"]')
      .evaluateAll(paths =>
        paths.filter(path => getComputedStyle(path).display !== 'none').map(path => path.getAttribute('d') ?? ''),
      )

  for (const [scale, notched] of [
    [1, false],
    [3, true],
  ] as const) {
    test(`draws the ${notched ? 'notched' : 'plain'} ears at ${scale}x`, async ({ browser }) => {
      const context = await browser.newContext({ deviceScaleFactor: scale })
      const page = await context.newPage()
      await page.goto('/')
      const ears = await visibleEars(page)
      expect(ears).toHaveLength(1)
      // The inner ears are the second and third subpaths of the notched drawing.
      expect(ears[0].split('M').length - 1).toBe(notched ? 3 : 1)
      await context.close()
    })
  }
})

test.describe('the reading region', () => {
  for (const width of [1440, 1920, 2560]) {
    test(`is centred in the sheet, with the contents beside the prose, at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/docs/latest/testing')
      const box = await page.evaluate(() => {
        const main = document.querySelector('main')!.getBoundingClientRect()
        const toc = document.querySelector('nav[aria-label="On this page"]')!.closest('aside')!.getBoundingClientRect()
        const sheet = document.querySelector('main')!.parentElement!.getBoundingClientRect()
        return { left: main.left - sheet.left, right: sheet.right - toc.right, gap: toc.left - main.right }
      })
      expect(Math.abs(box.left - box.right)).toBeLessThanOrEqual(2)
      expect(box.gap).toBeLessThanOrEqual(64)
    })
  }
})

test('a sidebar group folds away and back, with no script', async ({ page }) => {
  await page.goto('/docs/latest/guards')
  const nav = page.getByRole('navigation', { name: 'Documentation' })
  const group = nav.locator('details').first()
  const link = group.getByRole('link').first()
  await expect(link).toBeVisible()
  await group.locator('summary').click()
  await expect(link).toBeHidden()
  await group.locator('summary').click()
  await expect(link).toBeVisible()
})

test('the toolbar offers search by field and shortcut', async ({ page }) => {
  await page.goto('/docs/latest/guards')
  const search = page.getByRole('button', { name: 'Search the documentation' })
  await expect(search).toBeVisible()
  await expect(search).toHaveAttribute('data-search-trigger', 'true')
  await expect(search).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K')
})

test.describe('nothing spills past the reading column', () => {
  const pages = ['/docs/latest/guards', '/docs/latest/api/decorator/Command', '/docs/latest/changelog']
  for (const width of [390, 1280, 2560]) {
    for (const url of pages) {
      test(`${url} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(url)
        const spilled = await page.evaluate(() => {
          const main = document.querySelector('main')!.getBoundingClientRect()
          // Content inside a scrolling box may be wider than the column; the box itself may not.
          const scrolls = (element: Element) => /auto|scroll/.test(getComputedStyle(element).overflowX)
          return [...document.querySelectorAll('main *')]
            .filter(element => !scrolledWithin(element))
            .filter(element => element.getBoundingClientRect().right > main.right + 1)
            .map(element => `${element.tagName.toLowerCase()} ${element.textContent?.slice(0, 40)}`)
          function scrolledWithin(element: Element): boolean {
            for (let at = element.parentElement; at && at.tagName !== 'MAIN'; at = at.parentElement)
              if (scrolls(at)) return true
            return false
          }
        })
        expect(spilled).toEqual([])
      })
    }
  }
})
