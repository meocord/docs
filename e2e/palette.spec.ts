import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Search the documentation' })
const field = (page: Page) => dialog(page).getByRole('combobox')

/** Waits for the dialog's opening animation to end, so checks see the colours readers see. */
async function settled(page: Page) {
  await page.waitForFunction(() => {
    const layer = document.querySelector('[role="dialog"]')
    return layer?.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running') ?? false
  })
}

/** Console errors and CSP violations while the palette is in use. */
function watch(page: Page): string[] {
  const problems: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') problems.push(message.text())
  })
  page.on('pageerror', error => problems.push(error.message))
  void page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      console.error(`Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  return problems
}

test('the palette and its index load only when it first opens', async ({ page }) => {
  const loaded: string[] = []
  page.on('request', request => {
    if (/\/_pagefind\/|\/palette\//.test(request.url())) loaded.push(request.url())
  })
  await page.goto('/docs/4.1/defer')
  await page.waitForLoadState('networkidle')
  expect(loaded).toEqual([])

  await page.getByRole('button', { name: 'Search the documentation' }).click()
  await expect(field(page)).toBeFocused()
  await expect.poll(() => loaded.some(url => url.includes('/_pagefind/4.1.'))).toBe(true)
})

test('a search groups results, and Enter opens the one the arrows reach', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/docs/4.1/defer')
  await page.keyboard.press('ControlOrMeta+k')
  await expect(field(page)).toBeFocused()
  await page.keyboard.type('cooldown')

  const jump = dialog(page).getByRole('group', { name: 'Jump to' })
  await expect(jump.getByRole('option').first()).toContainText('Cooldown')
  await expect(dialog(page).getByRole('group', { name: 'Guides' })).toBeVisible()
  await expect(field(page)).toHaveAttribute('aria-activedescendant', /search-option-0/)

  // The second jump is the Cooldowns guide.
  await page.keyboard.press('ArrowDown')
  await expect(field(page)).toHaveAttribute('aria-activedescendant', 'search-option-1')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/docs\/4\.1\/cooldowns$/)
  await expect(dialog(page)).toBeHidden()
  expect(problems).toEqual([])
})

test('Escape closes the palette and hands focus back to the search field', async ({ page }) => {
  await page.goto('/docs/4.1/defer')
  const trigger = page.getByRole('button', { name: 'Search the documentation' })
  await trigger.click()
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(trigger).toBeFocused()

  // It opens again, from the slash key too.
  await page.locator('main').click()
  await page.keyboard.press('/')
  await expect(field(page)).toBeFocused()
})

test('a search with nothing in the line offers the others', async ({ page }) => {
  await page.goto('/docs/4.1/defer')
  await page.keyboard.press('ControlOrMeta+k')
  // The palette loads at the first open; keys typed before its field has focus go to the page.
  await expect(field(page)).toBeFocused()
  await page.keyboard.type('zqxjvw')
  await expect(dialog(page).getByRole('status')).toContainText('Nothing in 4.1')
  await dialog(page).getByRole('button', { name: 'Search in 4.0?' }).click()
  await expect(field(page)).toHaveAttribute('aria-label', 'Search MeoCord 4.0')
})

test('the current line is the scope, latest as the current line', async ({ page }) => {
  await page.goto('/docs/latest/guards')
  await page.keyboard.press('ControlOrMeta+k')
  await expect(field(page)).toHaveAttribute('aria-label', 'Search MeoCord 4.0')
})

test('keys typed while the palette first loads reach its field', async ({ page }) => {
  await page.goto('/docs/4.1/defer')
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('cooldown')
  await expect(field(page)).toHaveValue('cooldown')
  await expect(dialog(page).getByRole('option').first()).toContainText('Cooldown')
})

for (const scheme of ['light', 'dark'] as const) {
  test(`the open palette has no serious or critical accessibility violation, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/docs/4.1/defer')
    await page.keyboard.press('ControlOrMeta+k')
    await page.keyboard.type('cooldown')
    await expect(dialog(page).getByRole('option').first()).toBeVisible()
    await settled(page)
    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations
      .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
      .map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`)
    expect(serious).toEqual([])
  })
}
