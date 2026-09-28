import { expect, test } from '@playwright/test'
import { guidePath, guideRendered, readGuide } from '../scripts/lib/guide'
import { paths } from '../scripts/lib/layout'
import { listPages } from '../scripts/lib/pages'
import { readVersions } from '../scripts/lib/versions'
import { axe } from './axe'

// Every page written for the site, read from the content itself, so a new page is covered the day it lands:
// a line's Guide where the build renders it (DOCS_NEXT=1), its authored pages otherwise, and for a line whose
// guides come from its README, the pages taken from it, which render the same way
const LINES = readVersions(paths.versions).lines
const PAGES = LINES.flatMap(line =>
  guideRendered(line.line)
    ? readGuide(line.line).map(({ page }) => ({ path: `/docs/${line.line}/${guidePath(page)}`, title: page.title }))
    : listPages(line.line).map(page => ({ path: `/docs/${line.line}/${page.slug}`, title: page.title })),
)

// A DOCS_NEXT=1 build exists to test the Guide: one that renders none, its folder gone or renamed, would
// otherwise pass on the authored pages, every Guide spec skipped
test('a DOCS_NEXT=1 build renders a Guide for some line', () => {
  test.skip(process.env.DOCS_NEXT !== '1', 'only a DOCS_NEXT=1 build renders the Guide')
  expect(
    LINES.filter(line => guideRendered(line.line)).map(line => line.line),
    'no line has content/<line>-next',
  ).not.toEqual([])
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
