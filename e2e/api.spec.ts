import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { SearchManifest } from '../src/lib/search-manifest'
import { docs40, docs41, literal } from './lines'

const manifest = JSON.parse(readFileSync('.search/manifest.json', 'utf8')) as SearchManifest

test('a symbol page shows its declaration, links its types, and anchors its members', async ({ page }) => {
  const violations: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') violations.push(message.text())
  })
  // 4.1's API is arranged by kind; live-routes.spec checks its old pages by entry point redirect here
  const response = await page.goto(`${docs41}/api/controllers/ShardContext`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'ShardContext' })).toBeVisible()
  await expect(page.locator('[data-signature]').first()).toContainText('class ShardContext')
  await expect(page.locator('h3#constructor')).toBeVisible()
  await expect(page.locator('nav, aside').getByRole('link', { name: 'Cooldown', exact: true }).first()).toHaveAttribute(
    'href',
    `${docs41}/api/decorators/Cooldown`,
  )
  expect(violations).toEqual([])
})

// From the narrowest phone to a desktop: MeoCord's parameters table is wider than its frame at each
const TABLE_WIDTHS = [320, 375, 1024, 1440]

test('a parameter’s description reads at the frame’s width, beneath a row as tall as its own cells', async ({
  page,
}) => {
  for (const width of TABLE_WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/docs/4.3/api/decorator/MeoCord')
    const frame = page.locator('[data-params]').first()
    // Each description's box against the frame's, with the table where it starts and scrolled to its end
    const descriptions = () =>
      frame.evaluate(node => {
        const box = node.getBoundingClientRect()
        return [...node.querySelectorAll('tr[data-description] > td > [data-doc]')].map(doc => {
          const own = doc.getBoundingClientRect()
          const cell = getComputedStyle(doc.parentElement!)
          const room = box.width - parseFloat(cell.paddingLeft) - parseFloat(cell.paddingRight)
          return {
            inside: own.left >= box.left - 1 && own.right <= box.right + 1,
            // Content wider than its box, such as an unbroken URL, is cut off where no scroll reaches it
            clipped: doc.scrollWidth > doc.clientWidth,
            width: own.width,
            room,
          }
        })
      })
    const atStart = await descriptions()
    expect(atStart.length).toBeGreaterThan(20)
    expect(atStart.every(each => each.inside)).toBe(true)
    expect(atStart.filter(each => each.clipped)).toEqual([])
    // The longest fill the frame, less the cell's padding on each side
    expect(Math.max(...atStart.map(each => each.width - each.room))).toBeGreaterThan(-1)
    expect(await frame.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true)
    await frame.evaluate(node => node.scrollTo({ left: node.scrollWidth, behavior: 'instant' }))
    expect((await descriptions()).every(each => each.inside)).toBe(true)
    // A parameter's row is no taller than its own cells need: under twice its tallest cell's text, which a range
    // measures by its glyphs rather than its line boxes, with the cells' padding
    const taller = await frame.evaluate(node =>
      [...node.querySelectorAll('tbody tr:not([data-description])')].flatMap(row => {
        const cells = [...row.children] as HTMLElement[]
        const tallest = Math.max(
          ...cells.map(cell => {
            const range = document.createRange()
            range.selectNodeContents(cell)
            return range.getBoundingClientRect().height
          }),
        )
        const style = getComputedStyle(cells[0])
        const allowed = 2 * tallest + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        return row.getBoundingClientRect().height > allowed ? [cells[0].textContent] : []
      }),
    )
    expect(taller).toEqual([])
  }
})

test('a linked type opens its own page', async ({ page }) => {
  await page.goto(`${docs41}/api/decorators/Cooldown`)
  await page.locator('[data-signature] a', { hasText: 'CooldownOptions' }).first().click()
  await expect(page).toHaveURL(new RegExp(`${literal(docs41)}/api/types/CooldownOptions$`))
  await expect(page.getByRole('heading', { level: 1, name: 'CooldownOptions' })).toBeVisible()
})

test('an exact version has its own page, kept out of search indexes and pointing at the line', async ({ request }) => {
  const response = await request.get('/docs/4.0/api/4.0.0-beta.2/core/MeoCordFactory')
  expect(response.status()).toBe(200)
  const html = await response.text()
  // Noindex always; its links are followed once the site is indexable, which this build is not.
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>')
  expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]*${literal(docs40)}/api/core/MeoCordFactory"/>`))
})

test('an unknown symbol, entry or path shape is a 404', async ({ request }) => {
  for (const path of [
    '/docs/4.1/api/core/Nope',
    '/docs/4.1/api/nope/Cooldown',
    '/docs/4.1/api/a/b/c/d',
    '/docs/4.1/api/4.1.9/core/X',
  ]) {
    expect((await request.get(path)).status(), path).toBe(404)
  }
})

test('every API result search can return opens a page', async ({ request }) => {
  for (const line of manifest.lines) {
    const palette = (await (await request.get(line.palette)).json()) as { kind: string; url: string }[]
    const api = palette.filter(entry => entry.kind !== 'guide')
    for (const entry of api.slice(0, 40)) {
      expect((await request.get(entry.url)).status(), entry.url).toBe(200)
    }
  }
})
