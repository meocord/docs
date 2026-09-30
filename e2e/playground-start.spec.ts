import { expect, type Page, test } from '@playwright/test'

// A Guide page's playground that can't start, in each engine: the frame is where engines differ most
const PAGE = '/docs/4.1/components'
const FRAME = '**/playground/*.html'

const embed = (page: Page) => page.locator('[data-playground-embed]', { hasText: 'button counter/41' })
const run = (page: Page) => embed(page).getByRole('button', { name: 'Run' })
const output = (page: Page) => embed(page).locator('[data-playground-output]')

const BLOCKED =
  "The playground couldn't start: its frame didn't load, so a browser extension, the network or the site's settings may be blocking it. Press Run to try again."
const TIMED_OUT = "The playground couldn't start: its frame didn't load within 10 seconds. Press Run to try again."

test('says so when its frame is blocked, and starts a fresh frame on the next Run', async ({ page, browserName }) => {
  await page.route(FRAME, route => route.abort('blockedbyclient'))
  await page.goto(PAGE)
  await run(page).click()
  // Chromium loads the browser's error page in its place, which never says it is ready; Firefox and WebKit fire no
  // load or error for the frame at all, so the bound ends the wait
  await expect(output(page).locator('[data-playground-error]')).toHaveText(
    browserName === 'chromium' ? BLOCKED : TIMED_OUT,
    { timeout: browserName === 'chromium' ? 5_000 : 15_000 },
  )
  await expect(run(page)).toHaveText('Run')
  await expect(run(page)).not.toHaveAttribute('aria-busy')
  await expect(page.locator('iframe[data-playground-frame]')).toHaveCount(0)

  await page.unroute(FRAME)
  await run(page).click()
  await expect(output(page)).toContainText('CounterButtonController.count', { timeout: 30_000 })
  await expect(page.locator('iframe[data-playground-frame]')).toHaveCount(1)
})

test('gives up on a frame that never answers, within its bound, and runs once it can', async ({ page }) => {
  let answer!: () => void
  const held = new Promise<void>(resolve => (answer = resolve))
  // The request is held until the test lets it go; the removed frame has cancelled it by then
  await page.route(FRAME, async route => {
    await held
    await route.abort().catch(() => undefined)
  })
  await page.goto(PAGE)
  await run(page).click()
  await expect(output(page).locator('[data-playground-error]')).toHaveText(TIMED_OUT, { timeout: 15_000 })
  await expect(run(page)).toHaveText('Run')
  answer()
  await page.unrouteAll({ behavior: 'wait' })

  await run(page).click()
  await expect(output(page)).toContainText('CounterButtonController.count', { timeout: 30_000 })
})
