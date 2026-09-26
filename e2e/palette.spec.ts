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

test('its memoized parts still follow what they read: the active row, new results, hover and the line', async ({
  page,
}) => {
  await page.goto('/docs/4.1/defer')
  await page.keyboard.press('ControlOrMeta+k')
  await expect(field(page)).toBeFocused()
  await page.keyboard.type('cooldown')
  const options = dialog(page).getByRole('option')
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')

  // A row redraws when it becomes, or stops being, the active one.
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')

  // New results redraw the rows and their groups' titles.
  await field(page).fill('guard')
  await expect(options.first()).toContainText('Guard')
  await expect(dialog(page).getByRole('group', { name: 'Jump to' })).toBeVisible()

  // Hover looks a row up in the current results, not the ones it was first drawn with.
  await options.nth(2).hover()
  await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true')
  await expect(field(page)).toHaveAttribute('aria-activedescendant', (await options.nth(2).getAttribute('id'))!)

  // The line's chip follows the line searched.
  await field(page).fill('zqxjvw')
  await dialog(page).getByRole('button', { name: 'Search in 4.0?' }).click()
  await expect(dialog(page).getByText('4.0', { exact: true })).toBeVisible()
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

test('a key that reaches the field as it takes the loading keys adds to them', async ({ page }) => {
  await page.goto('/docs/4.1/defer')
  // The palette's chunk waits until the keys typed while it loads are in the buffer.
  let release: () => void = () => {}
  const held = new Promise<void>(resolve => (release = resolve))
  let requested = false
  await page.route('**/_next/static/chunks/**', async route => {
    requested = true
    await held
    await route.continue()
  })
  // A keystroke in the field right after the palette takes the buffer, before React draws it: where a
  // key that reads the field's old, empty value would drop the loading keys.
  await page.evaluate(() => {
    document.addEventListener(
      'focusin',
      event => {
        const field = event.target
        if (!(field instanceof HTMLInputElement) || field.getAttribute('role') !== 'combobox') return
        queueMicrotask(() => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, `${field.value}o`)
          field.dispatchEvent(new Event('input', { bubbles: true }))
        })
      },
      { once: true, capture: true },
    )
  })
  await page.keyboard.press('ControlOrMeta+k')
  await expect.poll(() => requested).toBe(true)
  await page.keyboard.type('co')
  release()
  await expect(field(page)).toHaveValue('coo')
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

test('a palette that fails to load leaves the keys to the page, and the next open tries again', async ({ page }) => {
  // Whether the page's last key press was taken, read after every listener on the document has run.
  await page.addInitScript(() => {
    window.addEventListener('keydown', event =>
      document.documentElement.toggleAttribute('data-taken', event.defaultPrevented),
    )
  })
  let offline = true
  let refused = 0
  await page.route('**/_next/static/chunks/**', async route => {
    const response = await route.fetch()
    if (offline && (await response.text()).includes('Search could not load')) {
      refused += 1
      return route.abort()
    }
    return route.fulfill({ response })
  })
  await page.goto('/docs/4.1/defer')
  await page.keyboard.press('ControlOrMeta+k')
  await expect.poll(() => refused).toBeGreaterThan(0)

  // Once the load has failed, a key the palette would have kept for its field is the page's again.
  const html = page.locator('html')
  await expect
    .poll(async () => {
      await page.keyboard.press('a')
      return html.getAttribute('data-taken')
    })
    .toBeNull()
  await expect(dialog(page)).toBeHidden()

  offline = false
  await page.keyboard.press('ControlOrMeta+k')
  await expect(field(page)).toBeFocused()
})
