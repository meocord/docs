import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { SearchManifest } from '../src/lib/search-manifest'

const manifest = JSON.parse(readFileSync('.search/manifest.json', 'utf8')) as SearchManifest

test('a symbol page shows its declaration, links its types, and anchors its members', async ({ page }) => {
  const violations: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') violations.push(message.text())
  })
  const response = await page.goto('/docs/4.1/api/core/ShardContext')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'ShardContext' })).toBeVisible()
  await expect(page.locator('[data-signature]').first()).toContainText('class ShardContext')
  await expect(page.locator('h3#constructor')).toBeVisible()
  await expect(page.locator('nav, aside').getByRole('link', { name: 'Cooldown', exact: true }).first()).toHaveAttribute(
    'href',
    '/docs/4.1/api/decorator/Cooldown',
  )
  expect(violations).toEqual([])
})

test('a linked type opens its own page', async ({ page }) => {
  await page.goto('/docs/4.1/api/decorator/Cooldown')
  await page.locator('[data-signature] a', { hasText: 'CooldownOptions' }).first().click()
  await expect(page).toHaveURL(/\/docs\/4\.1\/api\/interface\/CooldownOptions$/)
  await expect(page.getByRole('heading', { level: 1, name: 'CooldownOptions' })).toBeVisible()
})

test('an exact version has its own page, kept out of search indexes and pointing at the line', async ({ request }) => {
  const response = await request.get('/docs/4.0/api/4.0.0-beta.2/core/MeoCordFactory')
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('<meta name="robots" content="noindex, follow"/>')
  expect(html).toMatch(/<link rel="canonical" href="[^"]*\/docs\/latest\/api\/core\/MeoCordFactory"\/>/)
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
