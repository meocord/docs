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
