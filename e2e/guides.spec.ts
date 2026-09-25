import { expect, test } from '@playwright/test'

// Guides link the changelog and the migration guide by anchor; each must land on a heading there
test('links from the 4.1 guides into the changelog and migration guide land on their anchors', async ({ page }) => {
  const targets = new Set<string>()
  for (const slug of ['whats-new', 'cli', 'eslint', 'deployment', 'self-contained-builds', 'sharding']) {
    expect((await page.goto(`/docs/4.1/${slug}`))?.status(), slug).toBe(200)
    const hrefs = await page
      .locator('main a[href*="/changelog"], main a[href*="/migrating"]')
      .evaluateAll(links => links.map(link => link.getAttribute('href')!))
    hrefs.forEach(href => targets.add(href))
  }
  expect(targets.size).toBeGreaterThan(0)

  for (const href of targets) {
    const [path, anchor] = href.split('#')
    expect((await page.goto(path))?.status(), href).toBe(200)
    if (anchor) await expect(page.locator(`[id="${decodeURIComponent(anchor)}"]`), href).toHaveCount(1)
  }
})
