import { expect, type Page, test } from '@playwright/test'

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

test.describe('in the phone sheet', () => {
  test('narrows the sheet’s links, its field a 44px target, and Escape clears before it closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/docs/4.1/guards')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const sheet = page.getByRole('dialog', { name: 'Documentation' })
    const field = filter(sheet)
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44)

    await field.fill('guard')
    expect((await shown(sheet)).links.every(title => title.toLowerCase().includes('guard'))).toBe(true)
    await field.press('Escape')
    await expect(field).toHaveValue('')
    await expect(sheet).toBeVisible()
    await field.press('Escape')
    await expect(sheet).toBeHidden()
  })
})
