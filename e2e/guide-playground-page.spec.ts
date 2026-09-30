import { deflateRawSync } from 'node:zlib'
import { expect, type Page, test } from '@playwright/test'
import { axe } from './axe'

const PAGE = '/docs/4.1/playground'

// By role, which leaves out a page Next keeps hidden after navigating away from it
const code = (page: Page) => page.getByRole('textbox', { name: 'Code', exact: true })
const inputs = (page: Page) => page.getByRole('textbox', { name: 'Inputs', exact: true })
const run = (page: Page) => page.getByRole('button', { name: 'Run', exact: true })
const share = (page: Page) => page.getByRole('button', { name: 'Copy link' })
const output = (page: Page) => page.locator('[data-playground-page] [data-playground-output]').filter({ visible: true })
const status = (page: Page) => page.locator('[data-playground-status]').filter({ visible: true })

const LOUD = `import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class Hello {
  @Command('hello', CommandType.SLASH)
  async hello(interaction: ChatInputCommandInteraction, { name }: { name: string }) {
    await respond(interaction).send({ content: 'Hello, ' + name })
  }
}
`

test('sits beside the Guide and the API, and loads nothing of the playground until Run', async ({ page }) => {
  const seen: string[] = []
  await page.context().route('**/*', route => {
    seen.push(new URL(route.request().url()).pathname)
    return route.continue()
  })
  await page.goto('/docs/4.1/components')
  await page.getByRole('link', { name: 'Playground', exact: true }).first().click()
  await expect(page).toHaveURL(/\/docs\/4\.1\/playground$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Playground' })).toBeVisible()
  await expect(page.locator('[aria-current="page"]', { hasText: 'Playground' }).first()).toBeVisible()
  // The Playground tab is the section read, marked current as the other tabs are
  await expect(page.locator('[data-nav-tabs]:visible > a[aria-current="true"]')).toHaveText('Playground')

  // It starts from the Guide's first playground
  await expect(code(page)).toHaveValue(/export class CounterButtonController/)
  await expect(inputs(page)).toHaveValue('button counter/41')
  await expect(run(page)).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(seen.filter(path => path.startsWith('/playground/'))).toEqual([])

  await run(page).click()
  await expect(output(page)).toContainText('CounterButtonController.count', { timeout: 30_000 })
  expect(seen.filter(path => path.startsWith('/playground/')).length).toBeGreaterThanOrEqual(4)
})

test('runs what the reader writes, from the keyboard, and says what is wrong with the inputs', async ({ page }) => {
  await page.goto(PAGE)
  await code(page).fill(LOUD)
  await inputs(page).fill('/hello name:ada')
  await inputs(page).press('ControlOrMeta+Enter')
  await expect(output(page)).toContainText('Hello.hello', { timeout: 30_000 })
  await expect(output(page)).toContainText('Hello, ada')

  await inputs(page).fill('/hello; select')
  await run(page).click()
  await expect(status(page)).toHaveText('dispatch step 2: select needs a customId')
})

test("keeps what a reader typed before the page's script ran, and a link's code wins over the example", async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL!).origin })
  // The page's scripts are held until the reader has typed, as on a slow connection
  let release!: () => void
  const held = new Promise<void>(resolve => (release = resolve))
  await page.route('**/_next/static/**/*.js', async route => {
    await held
    await route.continue()
  })
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' })
  await code(page).fill(LOUD)
  await inputs(page).fill('/hello name:ada')
  release()
  await expect(run(page)).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(code(page)).toHaveValue(LOUD)
  await expect(inputs(page)).toHaveValue('/hello name:ada')

  // Opened from a link, the editor holds the link's code alone, not the example with it
  await share(page).click()
  await expect(status(page)).toHaveText('Link copied.')
  const opened = await context.newPage()
  await opened.goto(page.url())
  await expect(run(opened)).toBeVisible()
  await expect(code(opened)).toHaveValue(LOUD)
})

test("keeps what a reader typed over a shared link's code, and says the link's code wasn't loaded", async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL!).origin })
  await page.goto(PAGE)
  await code(page).fill(LOUD)
  await inputs(page).fill('/hello name:ada')
  await share(page).click()
  await expect(status(page)).toHaveText('Link copied.')

  // Opened on a slow connection: the reader starts editing the example before the page's scripts run
  const opened = await context.newPage()
  let release!: () => void
  const held = new Promise<void>(resolve => (release = resolve))
  await opened.route('**/_next/static/**/*.js', async route => {
    await held
    await route.continue()
  })
  await opened.goto(page.url(), { waitUntil: 'domcontentloaded' })
  await code(opened).fill('// my own edit')
  release()
  await expect(run(opened)).toBeVisible()
  await expect(status(opened)).toHaveText(
    "This link's code wasn't loaded, so your edits stay. Reload the page to open it.",
  )
  await expect(code(opened)).toHaveValue('// my own edit')
})

test('copies a link that carries the code and inputs, and opens from it', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL!).origin })
  await page.goto(PAGE)
  await code(page).fill(LOUD)
  await inputs(page).fill('/hello name:ada')
  await share(page).click()
  await expect(status(page)).toHaveText('Link copied.')
  await expect(page).toHaveURL(/\/docs\/4\.1\/playground#v1\.[\w-]+$/)
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toBe(page.url())
  expect(new URL(link).hash.length).toBeLessThan(1_800)

  const opened = await context.newPage()
  await opened.goto(link)
  await expect(code(opened)).toHaveValue(LOUD)
  await expect(inputs(opened)).toHaveValue('/hello name:ada')
  await run(opened).click()
  await expect(output(opened)).toContainText('Hello, ada', { timeout: 30_000 })
})

test('refuses to share code too long for a link, saying why', async ({ page }) => {
  await page.goto(PAGE)
  const noise = Array.from({ length: 1_600 }, (_, index) => ((index * 7919) % 65_521).toString(36)).join(' ')
  await code(page).fill(`// ${noise}\n${LOUD}`)
  await share(page).click()
  await expect(status(page)).toContainText('This code is too long to share as a link')
  await expect(status(page)).toContainText('a link carries up to 1,800, so it fits in a Discord message')
  expect(new URL(page.url()).hash).toBe('')
})

test('starts from an example when a link is damaged or carries more than a run takes', async ({ page }) => {
  const bomb = `v1.${deflateRawSync(Buffer.from(`{"source":"${'a'.repeat(5_000_000)}","dispatch":""}`)).toString('base64url')}`
  for (const fragment of ['v1.AAAA', 'v1.not-deflate', 'v2.abc', bomb]) {
    await page.goto(`${PAGE}#${fragment}`)
    await expect(status(page)).toHaveText(
      "This link's code couldn't be read, so the playground starts from an example.",
    )
    await expect(code(page)).toHaveValue(/export class CounterButtonController/)
  }
})

test("opens a Guide page's playground with its code and inputs", async ({ page }) => {
  await page.goto('/docs/4.1/components')
  await page.getByRole('link', { name: 'Open in playground' }).click()
  await expect(page).toHaveURL(/\/docs\/4\.1\/playground#v1\./)
  await expect(code(page)).toHaveValue(/export class CounterButtonController/)
  await expect(inputs(page)).toHaveValue('button counter/41')
})

test('shows the example and no buttons without script', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const page = await context.newPage()
  await page.goto(PAGE)
  await expect(code(page)).toHaveValue(/export class CounterButtonController/)
  await expect(page.locator('[data-playground-run]')).toBeHidden()
  await expect(page.locator('[data-playground-share]')).toBeHidden()
  await context.close()
})

test('answers at the line and the next alias only, not for an exact version or another line', async ({ request }) => {
  const next = await request.get('/docs/next/playground', { maxRedirects: 0 })
  expect(next.status()).toBe(307)
  expect(next.headers().location).toMatch(/\/docs\/4\.1\/playground$/)
  expect((await request.get('/docs/4.1/4.1.0-beta.7/playground')).status()).toBe(404)
  expect((await request.get('/docs/4.0/playground')).status()).toBe(404)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`has no serious accessibility violation with a result shown, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto(PAGE)
    await run(page).click()
    await expect(output(page)).toContainText('CounterButtonController.count', { timeout: 30_000 })
    const { violations } = await axe(page, builder =>
      builder.include('[data-playground-page]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']),
    )
    expect(
      violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target).join(', ')}`),
    ).toEqual([])
  })
}
