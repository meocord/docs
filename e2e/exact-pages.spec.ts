import { readFileSync } from 'node:fs'
import { type Page } from '@playwright/test'
import { expect, test } from './test'
import { cliParams, exactApiParams, lineVersions } from '../src/lib/docs/api-site'
import { CLI_SECTION } from '../src/lib/docs/cli-site'
import { EXACT_ROUTES_FILE, type ExactRoutes } from '../src/lib/docs/exact-routes'

// Every exact version's page, the API's and the CLI's, at its own version's URL
const PAGES = [
  ...exactApiParams().map(({ line, version, section, symbol }) => ({
    line,
    version,
    path: `/docs/${line}/api/${version}/${section}/${symbol}`,
  })),
  ...cliParams().flatMap(({ line, version, command }) =>
    version ? [{ line, version, path: `/docs/${line}/api/${version}/${CLI_SECTION}/${command}` }] : [],
  ),
]
const CHUNK = 250
// An exact version's page by its line and version: `/docs/4.1/api/4.1.0-beta.8/`
const EXACT_VERSION = /\/docs\/[^/]+\/api\/(\d+\.\d+\.\d+[^/]*)\//

/** Whether `named`, the versions a page says it serves (`a to b`, `a, b` or `a`), takes in `version`. */
function covers(line: string, named: string, version: string): boolean {
  const order = lineVersions(line).reverse()
  const [from, to] = named.split(' to ')
  if (to === undefined) return named.split(', ').includes(version)
  const at = order.indexOf(version)
  return order.indexOf(from!) <= at && at <= order.indexOf(to)
}

const decode = (text: string) =>
  text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"')

/** The versions a page's title and crumb name: the title's `<entry> <versions>`, and the crumb after the line's. */
function named(html: string): { title?: string; crumb?: string } {
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]
  const trail = /<nav[^>]*aria-label="Breadcrumb"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? ''
  const crumbs = [...trail.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map(match =>
    decode(match[1]!.replace(/<span[^>]*aria-hidden="true"[^>]*>\/<\/span>/g, '').replace(/<[^>]+>/g, '')).trim(),
  )
  return { title: title && decode(title).split(' · ')[1]?.replace(/^\S+ /, ''), crumb: crumbs[1] }
}

/** What is wrong with an exact version's page as served at its own URL, if anything. */
function problemsOf(page: (typeof PAGES)[number], status: number, html: string): string[] {
  if (status !== 200) return [`${page.path} answers ${status}`]
  const problems: string[] = []
  const { title, crumb } = named(html)
  if (!title || !covers(page.line, title, page.version)) problems.push(`${page.path}: its title names ${title}`)
  if (!crumb || !covers(page.line, crumb, page.version)) problems.push(`${page.path}: its crumb names ${crumb}`)
  const url = new URL(page.path, 'http://site')
  for (const [, href] of html.matchAll(/href="([^"]*)"/g)) {
    const target = new URL(decode(href!), url).pathname
    // A link to an exact version's page goes to the version the reader is on, written relative or not
    const version = EXACT_VERSION.exec(target)?.[1]
    if (version !== undefined && version !== page.version) problems.push(`${page.path}: ${href} leaves its version`)
  }
  return problems
}

for (let at = 0; at < PAGES.length; at += CHUNK) {
  const chunk = PAGES.slice(at, at + CHUNK)
  test(`exact versions' pages ${at + 1}–${at + chunk.length} of ${PAGES.length} answer, naming their version and linking within it`, async ({
    request,
  }) => {
    const problems: string[] = []
    for (let next = 0; next < chunk.length; next += 8) {
      const answers = await Promise.all(
        chunk.slice(next, next + 8).map(async page => {
          const response = await request.get(page.path)
          return problemsOf(page, response.status(), await response.text())
        }),
      )
      problems.push(...answers.flat())
    }
    expect(problems).toEqual([])
  })
}

// The routes the build wrote, which the proxy carries
const ROUTES = JSON.parse(readFileSync(EXACT_ROUTES_FILE, 'utf8')) as ExactRoutes

/** A line's shared pages: each version the proxy routes, and the first version of its group, which serves it. */
function sharedPages(line: string): [routed: string, served: string][] {
  const { versions, servedBy } = ROUTES[line]!
  return Object.entries(servedBy).flatMap(([page, by]) =>
    by.flatMap((served, at) =>
      served >= 0 && served !== at
        ? [
            [`/docs/${line}/api/${versions[at]}/${page}`, `/docs/${line}/api/${versions[served]}/${page}`] as [
              string,
              string,
            ],
          ]
        : [],
    ),
  )
}
const SIDEBAR_LINK = '[data-sidebar-body]:visible a[href^="../"]:not([aria-current])'

const crumbOf = async (page: Page) =>
  (await page.locator('nav[aria-label="Breadcrumb"] li').nth(1).innerText()).replace(/^\/\s*/, '').trim()

test("a shared page's links lead each version that serves it to its own pages, by full load and client navigation", async ({
  page,
  request,
}) => {
  // One with a linked type in its signature, and a sidebar to follow
  let found: [string, string] | undefined
  for (const [routed, served] of sharedPages('4.1')) {
    const html = await (await request.get(routed)).text()
    if (!/data-signature[^>]*>.*?<a href="\.\.\//s.test(html)) continue
    // The prerendered page of the group's first version itself, not one rendered for the routed URL
    expect(html, routed).toBe(await (await request.get(served)).text())
    found = [routed, served]
    break
  }
  expect(found).toBeDefined()
  for (const path of found!) {
    const version = EXACT_VERSION.exec(path)![1]!
    const own = `/docs/4.1/api/${version}/`
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('.', '\\.')}$`))
    expect(covers('4.1', await crumbOf(page), version), `${path}: ${await crumbOf(page)}`).toBe(true)

    // A type in a signature, an anchor of its own: a full load, under the reader's version
    await page.locator('[data-signature] a[href^="../"]').first().click()
    await expect.poll(() => new URL(page.url()).pathname).toContain(own)
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('.', '\\.')}$`))

    // A sidebar link, through the client router: the page doesn't reload, and stays on the reader's version
    await page.evaluate(() => ((window as unknown as { __stayed: boolean }).__stayed = true))
    const link = page.locator(SIDEBAR_LINK).first()
    const href = (await link.getAttribute('href'))!
    const title = (await link.innerText()).trim()
    const target = new URL(href, page.url()).pathname
    expect(target.startsWith(own), `${path}: ${href}`).toBe(true)
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${target.replaceAll('.', '\\.')}$`))
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __stayed?: boolean }).__stayed)).toBe(true)
    expect(covers('4.1', await crumbOf(page), version), `${target}: ${await crumbOf(page)}`).toBe(true)
    // The sidebar marks the page now read
    const current = await page.locator('[data-sidebar-body]:visible a[aria-current="page"]').getAttribute('href')
    expect(new URL(current!, page.url()).pathname).toBe(target)
  }
})
