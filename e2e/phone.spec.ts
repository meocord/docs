import { expect, type Page, test } from '@playwright/test'

// Every control a finger can reach, and its target: its box, or the invisible hit area around it.
const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('a, button, summary, input, [role="option"], [role="menuitem"]')]
      // Links inside running text or code, such as a signature's type names, are sized by the text.
      .filter(el => el.checkVisibility() && !el.closest('main p, main li, main td, main pre, footer'))
      .map(el => {
        const box = el.getBoundingClientRect()
        const after = getComputedStyle(el, '::after')
        const hit = after.content !== 'none' && after.position === 'absolute'
        // Rounded, so a box mid-transform at 43.999px counts as the 44 it is.
        const width = Math.round(Math.max(box.width, hit ? parseFloat(after.width) : 0))
        const height = Math.round(Math.max(box.height, hit ? parseFloat(after.height) : 0))
        return { name: el.getAttribute('aria-label') || el.innerText.trim().slice(0, 30), width, height }
      })
      .filter(target => target.width < 44 || target.height < 44),
  )

for (const width of [390, 430]) {
  test.describe(`at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
    })

    for (const url of ['/', '/docs/4.1/guards', '/docs/4.1/api/decorator/Command']) {
      test(`every control on ${url} is a 44px touch target`, async ({ page }) => {
        await page.goto(url)
        expect(await smallTargets(page)).toEqual([])
      })
    }

    test('the navigation sheet’s rows, theme control and close button are 44px touch targets', async ({ page }) => {
      await page.goto('/docs/4.1/guards')
      await page.getByRole('button', { name: 'Open navigation' }).click()
      await expect(page.getByRole('dialog', { name: 'Documentation' })).toBeVisible()
      await expect(page.getByRole('dialog').getByRole('group', { name: 'Colour theme' })).toBeVisible()
      expect(await smallTargets(page)).toEqual([])
    })

    test('the palette’s field and results are 44px touch targets', async ({ page }) => {
      await page.goto('/docs/4.1/guards')
      await page.locator('[data-search-trigger]').first().click()
      await page.keyboard.type('guard')
      await expect(page.getByRole('option').first()).toBeVisible()
      expect(await smallTargets(page)).toEqual([])
    })
  })
}

test('the page is drawn to the screen’s edges, and keeps its content clear of the safe area', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/docs/4.1/guards')
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/)
})
