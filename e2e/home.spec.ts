import { expect, test } from '@playwright/test'

test('the panel paints the finished run without any script', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await expect(panel.locator('[data-stage][data-state="done"]')).toHaveCount(7)
  await expect(panel.locator('[data-reply="member"]')).toBeVisible()
  await expect(panel.locator('[data-reply="member"]')).toContainText('Hello, Ada!')
  await expect(panel.locator('[data-pane="code"] code')).toContainText(
    'async greet(interaction: ChatInputCommandInteraction',
  )
  await context.close()
})

test('Run takes a member’s call through every stage to the reply', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-run]').click()
  await expect(panel).not.toHaveAttribute('data-answered')
  await expect(panel.locator('[data-reply="thinking"]')).toBeVisible()
  await expect(panel).toHaveAttribute('data-answered', '', { timeout: 6000 })
  await expect(panel.locator('[data-reply="member"]')).toContainText('Hello, Ada!')
  await expect(panel.locator('[data-stage][data-state="done"]')).toHaveCount(7)
  await expect(panel.locator('[data-pane="code"] .line[data-lit]')).toContainText('respond(interaction)')
})

test('a blocked user’s call stops at the guard, with its reason', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-choose="blocked"]').click()
  await expect(panel.locator('[data-stage="guard"]')).toHaveAttribute('data-state', 'stopped', { timeout: 6000 })
  await expect(panel.locator('[data-choose="blocked"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.locator('[data-stage="pipe"]')).toHaveAttribute('data-state', 'skipped')
  await expect(panel.locator('[data-reply="blocked"]')).toContainText('This command is for members.')
  await expect(panel.locator('[data-reply="member"]')).toBeHidden()
  await expect(panel.locator('[data-pane="code"] .line[data-lit="stopped"]')).toContainText('@UseGuard(MemberGuard)')
})

test('Step moves one stage at a time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-step]').click()
  await expect(panel.locator('[data-stage="defer"]')).toHaveAttribute('data-state', 'current')
  await expect(panel.locator('[data-narration]')).toContainText('three seconds')
  await panel.locator('[data-step]').click()
  await expect(panel.locator('[data-stage="guard"]')).toHaveAttribute('data-state', 'current')
  await expect(panel.locator('[data-stage="defer"]')).toHaveAttribute('data-state', 'done')
})

test('with reduced motion, Run reaches the reply at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const panel = page.locator('[data-pipeline]')
  await panel.locator('[data-run]').click()
  await expect(panel).toHaveAttribute('data-answered', '', { timeout: 500 })
})

for (const scheme of ['light', 'dark'] as const) {
  test(`stages not yet run stay readable in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('/')
    const panel = page.locator('[data-pipeline]')
    await panel.locator('[data-step]').click()
    await expect(panel.locator('[data-stage][data-state="pending"]')).toHaveCount(6)
    // The lowest contrast among the pending stages' visible text, against what is painted behind it.
    const lowest = await panel.evaluate(root => {
      const rgba = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number)
      const luminance = ([r, g, b]: number[]) => {
        const channel = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
      }
      const backdrop = (el: Element) => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          const [r, g, b, a = 1] = rgba(getComputedStyle(node).backgroundColor)
          if (a === 1) return [r, g, b]
        }
        return [255, 255, 255]
      }
      let min = Infinity
      for (const el of root.querySelectorAll(
        '[data-state="pending"] [data-stage-name], [data-state="pending"] [data-for]',
      )) {
        if (!(el as HTMLElement).offsetParent) continue
        let opacity = 1
        for (let node: Element | null = el; node; node = node.parentElement)
          opacity *= Number(getComputedStyle(node).opacity)
        const back = backdrop(el)
        const [r, g, b, a = 1] = rgba(getComputedStyle(el).color)
        const alpha = a * opacity
        const fore = [r, g, b].map((c, i) => c * alpha + back[i] * (1 - alpha))
        const [hi, lo] = [luminance(fore), luminance(back)].sort((x, y) => y - x)
        min = Math.min(min, (hi + 0.05) / (lo + 0.05))
      }
      return min
    })
    expect(lowest).toBeGreaterThanOrEqual(4.5)
  })
}
