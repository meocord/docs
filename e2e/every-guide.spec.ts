import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { paths } from '../scripts/lib/layout'
import { listPages } from '../scripts/lib/pages'
import { readVersions } from '../scripts/lib/versions'

// Every page written for the site, read from the content itself, so a new page is covered the day it lands
const PAGES = readVersions(paths.versions)
  .lines.filter(line => line.guides === 'authored')
  .flatMap(line => listPages(line.line).map(page => ({ path: `/docs/${line.line}/${page.slug}`, title: page.title })))

for (const { path, title } of PAGES) {
  test(`${path} renders its title, with no console error and no serious accessibility violation`, async ({ page }) => {
    const problems: string[] = []
    page.on('console', message => {
      if (message.type() === 'error') problems.push(message.text())
    })
    page.on('pageerror', error => problems.push(error.message))
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', event => {
        console.error(`Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`)
      })
    })

    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()

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
    expect(problems).toEqual([])
  })
}
