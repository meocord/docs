import { expect, test } from '@playwright/test'

// A phone's width, where the Command page's parameters table is wider than the column
const NARROW = { width: 375, height: 812 }
// Tab presses that reach the parameters table, at most, from the top of its page
const TAB_LIMIT = 200
// Arrow presses that scroll the table: WebKit lets the first key after focus go by, however focus arrived. Chromium
// scrolls on the first, and a second press at the end does nothing
const ARROW_PRESSES = 2

test.use({ viewport: NARROW })

// Chromium makes a scroll container focusable by itself; WebKit doesn't, so a table that overflows takes focus
// only because its frame does, which this checks in every engine it runs in
test('a table wider than the column is reached with Tab, scrolled with the arrow keys and named', async ({ page }) => {
  await page.goto('/docs/4.3/api/decorator/Command')
  const frame = page.getByRole('region', { name: 'Parameters' })
  await expect(frame).toHaveCount(1)
  expect(await frame.evaluate(node => node.scrollWidth - node.clientWidth)).toBeGreaterThan(0)

  let reached = false
  for (let press = 0; press < TAB_LIMIT && !reached; press++) {
    await page.keyboard.press('Tab')
    reached = await frame.evaluate(node => node === document.activeElement)
  }
  expect(reached).toBe(true)
  // The ring sits inside the frame, which clips what overflows it
  expect(
    await frame.evaluate(node => {
      const style = getComputedStyle(node)
      return [node.matches(':focus-visible'), style.outlineStyle, style.outlineOffset]
    }),
  ).toEqual([true, 'solid', '-2px'])

  for (let press = 0; press < ARROW_PRESSES; press++) await page.keyboard.press('ArrowRight')
  expect(await frame.evaluate(node => node === document.activeElement)).toBe(true)
  // The keys scroll smoothly, so the offset is read once the scroll has run
  await expect.poll(() => frame.evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
})
