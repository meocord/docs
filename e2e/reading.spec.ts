import { expect, test } from '@playwright/test'

const PAGE = '/docs/latest/getting-started'
// A page whose code frames include one without package-manager tabs
const PLAIN_CODE_PAGE = '/docs/latest/slash-commands'

test('code is coloured by theme, with no CSP violation', async ({ page }) => {
  const violations: string[] = []
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) violations.push(message.text())
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(PAGE)
  const token = page.locator('[data-code] code span[style*="--code-dark"]').first()
  const dark = await token.evaluate(span => getComputedStyle(span).color)
  // The mode switched as a reader switches it; the theme control answers once the page has hydrated
  const light = page.locator('[data-toolbar]:visible').getByRole('button', { name: 'Light' })
  await expect(light).toHaveAttribute('aria-pressed', 'false')
  await light.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const lightColour = await token.evaluate(span => getComputedStyle(span).color)
  expect(dark).not.toBe(lightColour)
  expect(violations).toEqual([])
})

test('the copy button copies the code and confirms', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(PLAIN_CODE_PAGE)
  const frame = page.locator('[data-code]:not([data-install])').first()
  const copy = frame.locator('[data-copy]')
  await copy.click()
  await expect(copy).toHaveAttribute('data-copied', '')
  await expect(copy).toHaveAccessibleName('Copied')
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toBe((await frame.locator('pre').innerText()).replace(/\n$/, ''))
})

test('the copy button draws its icons as plain SVG, 16 px square', async ({ page, request }) => {
  // As the page is served: sized by attributes, with no class
  const served = await (await request.get(PLAIN_CODE_PAGE)).text()
  const icons = [...served.matchAll(/<svg data-icon="[^"]*"[^>]*>/g)].map(([tag]) => tag)
  expect(icons.length).toBeGreaterThan(0)
  for (const tag of icons) {
    expect(tag).toContain(' width="16"')
    expect(tag).toContain(' height="16"')
    expect(tag).not.toContain(' class=')
  }
  await page.goto(PLAIN_CODE_PAGE)
  const icon = page.locator('[data-code]:not([data-install]) [data-copy] [data-icon="copy"]').first()
  expect(await icon.boundingBox()).toMatchObject({ width: 16, height: 16 })
})

test('install commands follow the chosen package manager, before paint on the next page', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(PAGE)
  const install = page.locator('[data-install]').first()
  await expect(install.locator('[data-pm-pane="npm"]')).toBeVisible()
  await expect(install.locator('[data-pm-pane="bun"]')).toBeHidden()

  await install.locator('[data-pm-choice="bun"]').click()
  await expect(install.locator('[data-pm-pane="bun"]')).toBeVisible()
  await expect(install.locator('[data-pm-pane="bun"]')).toContainText('bunx meocord')
  // The copy button copies the pane shown
  await install.locator('[data-copy]').click()
  await expect(install.locator('[data-copy]')).toHaveAttribute('data-copied', '')
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('bunx meocord')
  expect(clipboard).not.toContain('npx')

  await page.goto('/docs/latest/deployment')
  await expect(page.locator('html')).toHaveAttribute('data-pm', 'bun')
})

test('the table of contents follows the reading position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  await page.goto('/docs/latest/testing')
  const links = page.getByRole('navigation', { name: 'On this page' }).locator('[data-toc]')
  await expect(links.first()).toHaveAttribute('aria-current', 'location')
  const last = links.last()
  const id = await last.getAttribute('data-toc')
  await page.locator(`[id="${id}"]`).evaluate(heading => heading.scrollIntoView({ block: 'start' }))
  await expect(last).toHaveAttribute('aria-current', 'location')
  await expect(links.first()).not.toHaveAttribute('aria-current', 'location')
})

test('every page credits meo-canvas for its images', async ({ page }) => {
  await page.goto(PAGE)
  await expect(page.locator('main footer')).toContainText('Images drawn with meo-canvas')
  await expect(page.getByRole('link', { name: 'meo-canvas' })).toHaveAttribute(
    'href',
    'https://github.com/l7aromeo/meo-canvas',
  )
})
