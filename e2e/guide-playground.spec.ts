import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { guideRendered } from '../scripts/lib/guide'

// The Guide page that embeds a playground: components.md's typed route params, the counter button
const PAGE = '/docs/4.1/components'

test.skip(!guideRendered('4.1'), 'The Guide renders only in a build with DOCS_NEXT=1')

const embed = (page: Page) => page.locator('[data-playground-embed]').first()
const run = (page: Page) => embed(page).getByRole('button', { name: 'Run' })
const output = (page: Page) => embed(page).locator('[data-playground-output]')

/** Every request the page, its frames and their Workers make, by path, in order. */
async function track(page: Page): Promise<string[]> {
  const seen: string[] = []
  await page.context().route('**/*', route => {
    seen.push(new URL(route.request().url()).pathname)
    return route.continue()
  })
  return seen
}

test('loads nothing of the playground until Run, then runs the example and shows what it answered', async ({
  page,
}) => {
  const seen = await track(page)
  await page.goto(PAGE)
  await expect(run(page)).toBeVisible()
  await page.waitForLoadState('networkidle')
  const before = [...seen]
  expect(before.filter(path => path.startsWith('/playground/'))).toEqual([])
  expect(await page.locator('iframe').count()).toBe(0)

  await run(page).click()
  await expect(output(page)).toContainText('CounterButtonController.count', { timeout: 30_000 })
  const after = seen.slice(before.length)
  // The frame, its script, the runtime and the compiler, and the runner's own chunk, all fetched on Run
  expect(
    after
      .filter(path => path.startsWith('/playground/'))
      .map(path => path.split('.').pop())
      .sort(),
  ).toEqual(['html', 'js', 'js', 'wasm'])
  expect(after.some(path => path.startsWith('/_next/static/chunks/') && !before.includes(path))).toBe(true)

  await expect(output(page).locator('[data-playground-input]')).toHaveText(
    'button counter/41 → CounterButtonController.count',
  )
  await expect(output(page).locator('[data-playground-calls] li').first()).toContainText('update')
  await expect(output(page).locator('[data-playground-calls] li').first()).toContainText('buttons and menus: 42')
  await expect(run(page)).toHaveText('Run')
  // A clean run logs MeoCord's own line for the call, and nothing of the runtime's
  await output(page).locator('[data-playground-logs] summary').click()
  await expect(output(page).locator('[data-playground-logs] pre')).toHaveText(
    /^log\s+.* \[LOG\] \[TestingModule\] \[INTERACTION\] \[BUTTON\] \[count\]$/,
  )
})

test('runs again from the keyboard, announcing the result, with the frame out of reach', async ({ page }) => {
  await page.goto(PAGE)
  // The live region is in the tree before its first result, and the button is told apart by its inputs
  await expect(output(page)).toHaveAttribute('aria-live', 'polite')
  expect(await output(page).evaluate(el => getComputedStyle(el).display)).not.toBe('none')
  await expect(run(page)).toHaveAccessibleDescription('Dispatches button counter/41')
  await run(page).focus()
  await page.keyboard.press('Enter')
  await expect(output(page)).toContainText('CounterButtonController.count', { timeout: 30_000 })
  await page.keyboard.press('Enter')
  await expect(output(page)).toContainText('CounterButtonController.count', { timeout: 30_000 })

  const frame = page.locator('iframe[data-playground-frame]')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
  await expect(frame).toHaveAttribute('aria-hidden', 'true')
  await expect(frame).toHaveAttribute('tabindex', '-1')
  await expect(frame).toHaveAttribute('title', 'MeoCord playground runner')
  expect(await frame.evaluate(el => getComputedStyle(el).display)).not.toBe('none')
})

test("shows what the reader's code answers as text, never as markup", async ({ page }) => {
  await page.goto(PAGE)
  await expect(run(page)).toBeVisible()
  const markup = '<img src="x" onerror="window.__pwned = true"><b>bold</b>'
  await embed(page).evaluate((element, markup) => {
    const source = `
import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Loud {
  @Command('loud', CommandType.BUTTON)
  async loud(interaction: ButtonInteraction) {
    console.log(${JSON.stringify(markup)})
    await respond(interaction).send({ content: ${JSON.stringify(markup)}, embeds: [{ title: ${JSON.stringify(markup)} }] })
  }
}
`
    element.setAttribute(
      'data-playground-request',
      JSON.stringify({ source, dispatch: [{ kind: 'button', customId: 'loud' }] }),
    )
  }, markup)
  await run(page).click()
  await expect(output(page)).toContainText('Loud.loud', { timeout: 30_000 })
  await expect(output(page)).toContainText(markup)
  await output(page)
    .locator('details')
    .first()
    .evaluate(details => ((details as HTMLDetailsElement).open = true))
  expect(await output(page).locator('img, b').count()).toBe(0)
  expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined()
})

test('shows the code and no Run button without script', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const page = await context.newPage()
  await page.goto(PAGE)
  await expect(embed(page).locator('[data-code] pre')).toContainText('counter.build')
  await expect(embed(page).locator('[data-playground-run]')).toBeHidden()
  await context.close()
})

for (const scheme of ['light', 'dark'] as const) {
  test(`has no serious accessibility violation with a result shown, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto(PAGE)
    await run(page).click()
    await expect(output(page)).toContainText('CounterButtonController.count', { timeout: 30_000 })
    await output(page)
      .locator('details')
      .first()
      .evaluate(details => ((details as HTMLDetailsElement).open = true))
    const { violations } = await new AxeBuilder({ page })
      .include('[data-playground-embed]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(
      violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target).join(', ')}`),
    ).toEqual([])
  })
}
