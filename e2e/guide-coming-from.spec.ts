import { expect, test } from '@playwright/test'
import { axe } from './axe'

// The coming-from pages of the Guide

const PAGES = [
  ['/docs/4.1/coming-from/discordjs', 'Coming from discord.js'],
  ['/docs/4.1/coming-from/sapphire', 'Coming from Sapphire'],
  ['/docs/4.1/coming-from/discordx', 'Coming from discordx'],
  ['/docs/4.1/coming-from/necord', 'Coming from Necord'],
] as const

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme })
    for (const [path, title] of PAGES) {
      test(`${path} shows both frameworks' code, with no console error and no serious accessibility violation`, async ({
        page,
      }) => {
        const errors: string[] = []
        page.on('console', message => {
          if (message.type() === 'error') errors.push(message.text())
        })
        const response = await page.goto(path)
        expect(response?.status()).toBe(200)
        await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible()
        // Every example drawn as code, none left as its directive
        await expect(page.getByText('::example')).toHaveCount(0)
        expect(await page.locator('pre code').count()).toBeGreaterThan(8)
        const { violations } = await axe(page, builder =>
          builder.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']),
        )
        expect(violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id)).toEqual([])
        expect(errors).toEqual([])
      })
    }
  })
}
