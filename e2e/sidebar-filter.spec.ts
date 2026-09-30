import { expect, type Page, test } from '@playwright/test'
import { axe } from './axe'

const body = (page: Page) => page.locator('[data-sidebar-body]:visible')
const filter = (scope: ReturnType<Page['locator']>) => scope.getByRole('searchbox', { name: 'Filter pages' })
/** The titles of the links a sidebar shows, and of the groups it shows them in. */
const shown = (scope: ReturnType<Page['locator']>) =>
  scope.evaluate(root => ({
    links: [...root.querySelectorAll<HTMLAnchorElement>('[data-nav-group] li > a')]
      .filter(link => link.checkVisibility())
      .map(link => link.textContent ?? ''),
    groups: [...root.querySelectorAll<HTMLElement>('[data-nav-group]')]
      .filter(group => group.checkVisibility())
      .map(group => group.querySelector('summary')?.textContent ?? ''),
  }))

test.describe('on a desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('narrows the links to titles that hold what is typed, whatever its case or accents, in their groups', async ({
    page,
  }) => {
    await page.goto('/docs/4.1/guards')
    const all = await shown(body(page))
    await filter(body(page)).fill('GUÁRD')
    const narrowed = await shown(body(page))
    expect(narrowed.links).toEqual(all.links.filter(title => title.toLowerCase().includes('guard')))
    expect(narrowed.links).toContain('Guards')
    expect(narrowed.groups).toContain('The request pipeline')
    expect(narrowed.groups.length).toBeLessThan(all.groups.length)
    // The page read is still the one marked
    await expect(body(page).locator('[aria-current="page"]')).toHaveText('Guards')
  })

  test('says when no page matches, and Escape clears it', async ({ page }) => {
    await page.goto('/docs/4.1/guards')
    const all = await shown(body(page))
    await filter(body(page)).fill('zzqx')
    await expect(body(page).getByRole('status')).toHaveText('No pages match')
    expect((await shown(body(page))).links).toEqual([])

    await filter(body(page)).press('Escape')
    await expect(filter(body(page))).toHaveValue('')
    await expect(body(page).getByRole('status')).toHaveText('')
    expect(await shown(body(page))).toEqual(all)
    await expect(body(page).locator('[aria-current="page"]')).toHaveText('Guards')
  })

  test("narrows the API tab's links, keeping each match's category", async ({ page }) => {
    await page.goto('/docs/4.1/api/decorators/Cooldown')
    await filter(body(page)).fill('cooldown')
    const narrowed = await shown(body(page))
    expect(narrowed.links).toContain('Cooldown')
    expect(narrowed.links.every(title => title.toLowerCase().includes('cooldown'))).toBe(true)
    const category = body(page).locator('ul[aria-label="Pipeline stages"]')
    await expect(category.getByRole('link', { name: 'Cooldown', exact: true })).toBeVisible()
  })

  test('is reached from the keyboard, after the tabs', async ({ page }) => {
    await page.goto('/docs/4.1/guards')
    await body(page).getByRole('link', { name: 'API', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(filter(body(page))).toBeFocused()
  })
})

test.describe('pinned at the top of the sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('stays in view deep in the API list, filters from there, and clears back to there', async ({ page }) => {
    await page.goto('/docs/4.1/api/decorators/Cooldown')
    await body(page).evaluate(node => (node.scrollTop = node.scrollHeight))
    expect(await body(page).evaluate(node => node.scrollTop)).toBeGreaterThan(1000)
    const view = (await body(page).boundingBox())!
    const field = (await filter(body(page)).boundingBox())!
    expect(field.y).toBeGreaterThanOrEqual(view.y)
    expect(field.y + field.height).toBeLessThan(view.y + 80)

    const deep = await body(page).evaluate(node => node.scrollTop)

    // The matches show from the top; cleared, the sidebar is back where the reader was
    await filter(body(page)).fill('cooldown')
    await expect(body(page).getByRole('link', { name: 'Cooldown', exact: true })).toBeInViewport()
    await filter(body(page)).press('Escape')
    await expect(filter(body(page))).toHaveValue('')
    expect(await body(page).evaluate(node => node.scrollTop)).toBe(deep)
  })

  test('keeps the current link, scrolled up into view, clear of the field', async ({ page }) => {
    // Troubleshooting's link is near the sidebar's end, and Guards' far above it
    await page.goto('/docs/4.1/troubleshooting')
    await expect.poll(() => body(page).evaluate(node => node.scrollTop)).toBeGreaterThan(0)
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByRole('dialog').getByRole('combobox').fill('Guards')
    await expect(page.getByRole('dialog').getByRole('option').first()).toContainText('Guards')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/guards$/)

    const current = body(page).locator('[aria-current="page"]')
    await expect(current).toHaveText('Guards')
    const field = (await filter(body(page)).boundingBox())!
    await expect.poll(async () => (await current.boundingBox())!.y).toBeGreaterThanOrEqual(field.y + field.height)
    expect(await body(page).evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  })

  test('keeps a link focused from the keyboard clear of the field', async ({ page }) => {
    await page.goto('/docs/4.1/guards')
    const links = body(page).locator('[data-nav-group] li > a')
    // Scrolled so a link sits under the field, then focused: it scrolls out from under it
    const target = links.nth(12)
    await body(page).evaluate(
      (node, top) => (node.scrollTop += top - node.getBoundingClientRect().top - 4),
      (await target.boundingBox())!.y,
    )
    const field = (await filter(body(page)).boundingBox())!
    expect((await target.boundingBox())!.y).toBeLessThan(field.y + field.height)
    await target.focus()
    expect((await target.boundingBox())!.y).toBeGreaterThanOrEqual(field.y + field.height)
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no serious contrast violation over the links under it, in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/docs/4.1/api/decorators/Cooldown')
      await body(page).evaluate(node => (node.scrollTop = node.scrollHeight / 2))
      const serious = async () =>
        (await axe(page, builder => builder.withRules(['color-contrast']))).violations
          .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
          .flatMap(violation => violation.nodes.map(node => node.target.join(' ')))
      expect(await serious(), 'scrolled').toEqual([])
      await filter(body(page)).fill('zzqx')
      await expect(body(page).getByRole('status')).toHaveText('No pages match')
      expect(await serious(), 'no match').toEqual([])
    })
  }
})

test.describe('in the phone sheet', () => {
  test('narrows the sheet’s links, its field a 44px target, and Escape clears before it closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/docs/4.1/guards')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const sheet = page.getByRole('dialog', { name: 'Documentation' })
    const field = filter(sheet)
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    // Pinned in the sheet too: still at its top once the links are scrolled
    const scroller = sheet.locator('[data-sheet-links]')
    await scroller.evaluate(node => (node.scrollTop = node.scrollHeight))
    const view = (await scroller.boundingBox())!
    const pinned = (await field.boundingBox())!
    expect(pinned.y).toBeGreaterThanOrEqual(view.y)
    expect(pinned.y + pinned.height).toBeLessThan(view.y + 80)

    await field.fill('guard')
    expect((await shown(sheet)).links.every(title => title.toLowerCase().includes('guard'))).toBe(true)
    await field.press('Escape')
    await expect(field).toHaveValue('')
    await expect(sheet).toBeVisible()
    await field.press('Escape')
    await expect(sheet).toBeHidden()
  })
})
