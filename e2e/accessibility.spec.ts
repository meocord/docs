import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// The page types a reader meets: home, the longest guide and one with code near its top, an API page,
// the changelog and a release's page, a missing page.
const PAGES = [
  '/',
  '/docs/4.1/defer',
  '/docs/4.1/testing',
  '/docs/4.1/api/core/ShardContext',
  '/docs/4.1/changelog',
  '/docs/4.1/changelog/4.1.0-beta.0',
  '/docs/4.0/missing/interceptors',
]

for (const path of PAGES) {
  test(`${path} has no serious or critical accessibility violation`, async ({ page }) => {
    await page.goto(path)
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = violations
      .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
      .map(
        violation =>
          `${violation.id} (${violation.impact}): ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`,
      )
    expect(serious).toEqual([])
  })
}

// Landmarks at any impact, at a width that draws every pane: each complementary pane named apart
const LANDMARK_RULES = [
  'landmark-unique',
  'landmark-one-main',
  'landmark-complementary-is-top-level',
  'landmark-no-duplicate-banner',
  'landmark-no-duplicate-contentinfo',
  'landmark-no-duplicate-main',
]

for (const path of PAGES) {
  test(`${path} names each of its landmarks apart`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(path)
    const { violations } = await new AxeBuilder({ page }).withRules(LANDMARK_RULES).analyze()
    expect(
      violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`),
    ).toEqual([])
  })
}
