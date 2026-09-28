import { expect, test } from '@playwright/test'
import { guideRendered } from '../scripts/lib/guide'

// The pipeline figure on How a call runs, which only a build that renders the Guide draws
test.skip(!guideRendered('4.1'), 'the Guide renders only in a DOCS_NEXT=1 build')

test('the pipeline figure draws each stage as a card, and a kind of handler picked shows only its stages', async ({
  page,
}) => {
  await page.goto('/docs/4.1/how-a-call-runs')
  const figure = page.locator('[data-pipeline-figure]')
  await expect(figure).toBeVisible()

  // Styled by the reading column: a stage that wraps none is a bordered card
  const card = figure.locator('li:not([data-frame]) > [data-stage]').first()
  await expect(card).toHaveCSS('border-top-width', '1px')

  const stage = (name: string) =>
    figure.locator('li', { has: page.locator(':scope > [data-stage] > a', { hasText: new RegExp(`^${name}$`) }) })
  // Only a message command parses; the figure's own radios pick the kind, with no script
  await figure.getByLabel('Message command', { exact: true }).check()
  await expect(stage('Parse')).toBeVisible()
  await figure.getByLabel('Command', { exact: true }).check()
  await expect(stage('Parse')).toBeHidden()
  await expect(stage('Guards')).toBeVisible()
})
