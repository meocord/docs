import { expect, type Page, test } from '@playwright/test'

// On a desktop each pane is a header that stays put over a body that scrolls.
const sidebar = (page: Page) => page.locator('[data-sidebar]:visible')
const sidebarBody = (page: Page) => page.locator('[data-sidebar-body]:visible')
const sheet = (page: Page) => page.locator('[data-sheet]:visible')
const top = (body: ReturnType<typeof sheet>) => body.evaluate(element => element.scrollTop)

/** Whether an element lies wholly inside the visible part of its scroller. */
const inView = (page: Page, selector: string, scroller: string) =>
  page.evaluate(
    ([selector, scroller]) => {
      const body = [...document.querySelectorAll(scroller)].find(element => element.checkVisibility())!
      const target = body.querySelector(selector)!.getBoundingClientRect()
      const view = body.getBoundingClientRect()
      return target.top >= view.top && target.bottom <= view.bottom
    },
    [selector, scroller],
  )

/** A sidebar link on show and not the current one, for navigating by the sidebar. */
const visibleLink = (page: Page) =>
  page.evaluate(() => {
    const body = [...document.querySelectorAll('[data-sidebar-body]')].find(element => element.checkVisibility())!
    const view = body.getBoundingClientRect()
    const link = [...body.querySelectorAll<HTMLAnchorElement>('a[href^="/docs/"]:not([aria-current])')].find(
      candidate => {
        const box = candidate.getBoundingClientRect()
        return box.top > view.top + 40 && box.bottom < view.bottom - 40
      },
    )!
    return link.getAttribute('href')!
  })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('the sidebar’s header stays put and only its navigation scrolls, beside its own scrollbar', async ({ page }) => {
  await page.goto('/docs/4.1/guards')
  const brand = sidebar(page).locator('a[href="/"]')
  const before = (await brand.boundingBox())!.y
  await page.mouse.move(140, 600)
  await page.mouse.wheel(0, 600)
  await expect.poll(() => top(sidebarBody(page))).toBeGreaterThan(0)

  expect((await brand.boundingBox())!.y).toBe(before)
  // The pane itself never scrolls, so no scrollbar runs up beside the header.
  expect(await sidebar(page).evaluate(pane => [pane.scrollTop, pane.scrollHeight - pane.clientHeight])).toEqual([0, 0])
  expect((await sidebarBody(page).boundingBox())!.y).toBeGreaterThanOrEqual(
    before + (await brand.boundingBox())!.height,
  )
})

test('the sidebar keeps its place as the reader moves on, and a page gone back to keeps its own', async ({ page }) => {
  await page.goto('/docs/4.1/guards')
  await sidebarBody(page).evaluate(body => (body.scrollTop = 300))
  const first = await top(sidebarBody(page))

  await page.locator(`[data-sidebar-body]:visible a[href="${await visibleLink(page)}"]`).click()
  await expect(page).not.toHaveURL(/\/guards$/)
  await expect.poll(() => top(sidebarBody(page))).toBe(first)

  // Scrolled on the second page, then back: the first page's sidebar is where it was left.
  await sidebarBody(page).evaluate(body => (body.scrollTop = 120))
  await page.goBack()
  await expect(page).toHaveURL(/\/guards$/)
  await expect.poll(() => top(sidebarBody(page))).toBe(first)
})

test('the current link is brought into view only when it is out of sight', async ({ page }) => {
  // The first page's link is at the sidebar's top: nothing to scroll.
  await page.goto('/docs/4.1/overview')
  expect(await top(sidebarBody(page))).toBe(0)

  // Troubleshooting's link is near the sidebar's end: reached by search, it is scrolled to.
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('dialog').getByRole('combobox').fill('Troubleshooting')
  await expect(page.getByRole('dialog').getByRole('option').first()).toContainText('Troubleshooting')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/troubleshooting$/)
  await expect.poll(() => top(sidebarBody(page))).toBeGreaterThan(0)
  expect(await inView(page, '[aria-current="page"]', '[data-sidebar-body]')).toBe(true)

  // A link already on show moves nothing.
  const kept = await top(sidebarBody(page))
  await page.locator(`[data-sidebar-body]:visible a[href="${await visibleLink(page)}"]`).click()
  await expect(page).not.toHaveURL(/\/troubleshooting$/)
  await expect.poll(() => top(sidebarBody(page))).toBe(kept)
})

test('each line keeps its own sidebar place', async ({ page }) => {
  await page.goto('/docs/4.1/guards')
  await sidebarBody(page).evaluate(body => (body.scrollTop = 300))

  await page
    .locator('[data-toolbar]:visible')
    .getByRole('button', { name: /^Documentation version/ })
    .click()
  // 4.0 is the current line, reached as latest.
  await page.getByRole('menuitem', { name: '4.0' }).click()
  await expect(page).toHaveURL(/\/docs\/latest\//)
  await expect.poll(() => top(sidebarBody(page))).not.toBe(300)
  expect(await inView(page, '[aria-current="page"]', '[data-sidebar-body]')).toBe(true)
})

test('a contents link lands its heading below the toolbar, and the contents mark it', async ({ page }) => {
  await page.goto('/docs/4.1/guards')
  const link = page.locator('[data-sheet]:visible nav[aria-label="On this page"] a').nth(2)
  const id = (await link.getAttribute('href'))!.slice(1)
  await link.click()
  await expect.poll(() => top(sheet(page))).toBeGreaterThan(0)

  const toolbar = (await page.locator('[data-toolbar]:visible').boundingBox())!
  const heading = (await page.locator(`[data-sheet]:visible [id="${id}"]`).boundingBox())!
  expect(heading.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height)
  expect(heading.y).toBeLessThan(toolbar.y + toolbar.height + 80)
  await expect(link).toHaveAttribute('aria-current', 'location')
})

test('Space scrolls the sheet from the page', async ({ page }) => {
  await page.goto('/docs/4.1/guards')
  await page.keyboard.press(' ')
  await expect.poll(() => top(sheet(page))).toBeGreaterThan(400)
})

// A reader's find-in-page cannot be driven from a test, and a headless window.find selects the match
// without scrolling to it; so this finds the text, then reveals the match as find-in-page does, by
// scrolling its nearest scroller, and checks it lands in the sheet's body, clear of the toolbar.
test('text found on the page is revealed in the sheet, clear of the toolbar', async ({ page }) => {
  await page.goto('/docs/4.1/guards')
  const text = await page.evaluate(() => {
    const body = [...document.querySelectorAll('[data-sheet]')].find(element => element.checkVisibility())!
    const paragraphs = [...body.querySelectorAll('article p')]
    return (paragraphs.at(-3)?.textContent ?? '').trim().split(/\s+/).slice(0, 5).join(' ')
  })
  expect(text.length).toBeGreaterThan(10)
  expect(
    await page.evaluate(found => (window as unknown as { find: (text: string) => boolean }).find(found), text),
  ).toBe(true)
  await page.evaluate(() =>
    window.getSelection()!.getRangeAt(0).startContainer.parentElement!.scrollIntoView({ block: 'nearest' }),
  )
  await expect.poll(() => top(sheet(page))).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const found = await page.evaluate(() => {
    const range = window.getSelection()!.getRangeAt(0).getBoundingClientRect()
    const body = [...document.querySelectorAll('[data-sheet]')].find(element => element.checkVisibility())!
    const view = body.getBoundingClientRect()
    return range.top >= view.top && range.bottom <= view.bottom
  })
  expect(found).toBe(true)
})

test('printed, the page runs its full length with no panes or chrome', async ({ page }) => {
  await page.goto('/docs/4.1/guards')
  await page.emulateMedia({ media: 'print' })
  await expect(sidebar(page)).toBeHidden()
  await expect(page.locator('[data-toolbar]').first()).toBeHidden()
  const [scrollHeight, clientHeight] = await page
    .locator('[data-sheet]')
    .first()
    .evaluate(body => [body.scrollHeight, body.clientHeight])
  expect(clientHeight).toBe(scrollHeight)
  expect(clientHeight).toBeGreaterThan(2000)
})
