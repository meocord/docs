import { expect, test } from '@playwright/test'
import { guidePath, readGuide } from '../scripts/lib/guide'
import { paths } from '../scripts/lib/layout'
import { listPages } from '../scripts/lib/pages'
import { readVersions } from '../scripts/lib/versions'
import { axe } from './axe'

// Every page written for the site, read from the content itself, so a new page is covered the day it lands: a
// line's Guide where its guides are authored, and for a line whose guides come from its README, the pages taken
// from it, which render the same way
const LINES = readVersions(paths.versions).lines
const GUIDES = LINES.filter(line => line.guides === 'authored').map(line => ({
  line: line.line,
  pages: readGuide(line.line),
}))
const PAGES = [
  ...GUIDES.flatMap(({ line, pages }) =>
    pages.map(({ page }) => ({ path: `/docs/${line}/${guidePath(page)}`, title: page.title })),
  ),
  ...LINES.filter(line => line.guides === 'readme').flatMap(line =>
    listPages(line.line).map(page => ({ path: `/docs/${line.line}/${page.slug}`, title: page.title })),
  ),
]

// A line whose Guide folder is missing or renamed would otherwise leave this spec with no page of it to test
test('every line whose guides are authored has Guide pages', () => {
  expect(GUIDES.filter(guide => guide.pages.length === 0).map(guide => `content/${guide.line}`)).toEqual([])
})

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

    const { violations } = await axe(page, builder => builder.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']))
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
