import { expect, test } from '@playwright/test'
import { axe } from './axe'

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

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** axe's serious and critical violations, as lines naming each rule and where it failed. */
const seriousOf = (violations: Awaited<ReturnType<typeof axe>>['violations']) =>
  violations
    .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      violation =>
        `${violation.id} (${violation.impact}): ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`,
    )

for (const path of PAGES) {
  test(`${path} has no serious or critical accessibility violation`, async ({ page }) => {
    await page.goto(path)
    const { violations } = await axe(page, builder => builder.withTags(WCAG))
    expect(seriousOf(violations)).toEqual([])
  })
}

// The home panel in each state a reader sees it in: as the server paints it, which reduced motion keeps by
// not playing the demo; once the demo has played to its lit line; and with a blocked call stopped at the
// guard. Each measured once it has settled, so a lit line's colours are read on the background it keeps.
for (const scheme of ['light', 'dark'] as const) {
  test(`the home panel has no serious violation as painted, played or stopped, in ${scheme}`, async ({ browser }) => {
    const painted = await browser.newContext({ colorScheme: scheme, reducedMotion: 'reduce' })
    const still = await painted.newPage()
    await still.goto('/')
    await expect(still.locator('[data-pipeline] .line[data-lit]')).toHaveCount(0)
    expect(seriousOf((await axe(still, builder => builder.withTags(WCAG))).violations), 'as painted').toEqual([])
    await painted.close()

    const context = await browser.newContext({ colorScheme: scheme })
    const page = await context.newPage()
    await page.goto('/')
    const panel = page.locator('[data-pipeline]')
    await expect(panel.locator('[data-pane="code"] .line[data-lit="current"]')).toBeVisible({ timeout: 10_000 })
    await expect(panel).toHaveAttribute('data-answered', '')
    expect(seriousOf((await axe(page, builder => builder.withTags(WCAG))).violations), 'played').toEqual([])

    await panel.locator('[data-choose="blocked"]').click()
    await expect(panel.locator('[data-pane="code"] .line[data-lit="stopped"]')).toBeVisible({ timeout: 10_000 })
    await expect(panel).toHaveAttribute('data-answered', '')
    expect(seriousOf((await axe(page, builder => builder.withTags(WCAG))).violations), 'stopped').toEqual([])
    await context.close()
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
    const { violations } = await axe(page, builder => builder.withRules(LANDMARK_RULES))
    expect(
      violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`),
    ).toEqual([])
  })
}
