import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { rankResults } from '../src/lib/search-rank'
import type { SearchManifest } from '../src/lib/search-manifest'

// Written by `bun run search:build`, which `bun run build` runs first.
const manifest = JSON.parse(readFileSync('.search/manifest.json', 'utf8')) as SearchManifest
const prerelease = manifest.lines.find(line => line.status === 'prerelease') ?? manifest.lines[0]

/** The part of a Pagefind result's data the test reads. */
interface PagefindData {
  url: string
  meta?: { title?: string }
  filters?: { kind?: string[]; line?: string[] }
  sub_results?: { url: string }[]
}

interface Found {
  results: { score: number; url: string; title: string; kind: string; line?: string; sub: string[] }[]
}

test('every line has a search bundle and a palette index, cached as immutable', async ({ request }) => {
  expect(manifest.lines.length).toBeGreaterThan(0)
  for (const line of manifest.lines) {
    const bundle = await request.get(`${line.search}pagefind.js`)
    expect(bundle.status(), line.search).toBe(200)
    expect(bundle.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(bundle.headers()['x-robots-tag']).toBe('noindex, nofollow')

    const palette = await request.get(line.palette)
    expect(palette.status(), line.palette).toBe(200)
    expect(palette.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(palette.headers()['content-security-policy']).toContain("default-src 'none'")
    const entries = (await palette.json()) as { name: string; kind: string; url: string }[]
    expect(entries.some(entry => entry.kind === 'guide')).toBe(true)
    expect(entries.every(entry => entry.url.startsWith('/docs/'))).toBe(true)
  }
})

/** Runs a search in the page for each query, with every result's score and data read. */
async function search(page: Page, base: string, queries: string[]) {
  return (await page.evaluate(
    async ([base, queries]) => {
      const pagefind = await import(/* @vite-ignore */ `${base}pagefind.js`)
      await pagefind.options({ basePath: base })
      const out: Record<string, Found['results']> = {}
      for (const query of queries) {
        const search = await pagefind.search(query)
        out[query] = await Promise.all(
          search.results.slice(0, 30).map(async (result: { score: number; data: () => Promise<PagefindData> }) => {
            const data = await result.data()
            return {
              score: result.score,
              url: data.url,
              title: data.meta?.title ?? '',
              kind: data.filters?.kind?.[0] ?? '',
              line: data.filters?.line?.[0],
              sub: (data.sub_results ?? []).map(sub => sub.url),
            }
          }),
        )
      }
      return out
    },
    [base, queries] as const,
  )) as Record<string, Found['results']>
}

test('a search runs in the page under its CSP and finds guides and API symbols', async ({ page }) => {
  const violations: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') violations.push(message.text())
  })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      console.error(`Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  await page.goto('/')

  const found = await search(page, prerelease.search, ['cooldown', 'createMockInteraction'])
  const cooldown = rankResults('cooldown', found.cooldown)
  expect(cooldown.length).toBeGreaterThan(0)
  expect(cooldown.every(result => result.line === prerelease.line)).toBe(true)
  // A reader typing a topic finds its guide near the top, with its sections as sub-results.
  const guide = cooldown.slice(0, 3).find(result => result.kind === 'guide' && /\/cooldowns$/.test(result.url))
  expect(guide, 'the Cooldowns guide in the top 3 for "cooldown"').toBeDefined()
  expect(guide!.sub.some(url => url.includes('#'))).toBe(true)
  expect(cooldown.find(result => result.kind === 'api')?.url).toMatch(
    new RegExp(`^/docs/(${prerelease.line}|latest)/api/[a-z]+/\\w+$`),
  )
  // A symbol's exact name finds its API page first.
  expect(rankResults('createMockInteraction', found.createMockInteraction)[0]).toMatchObject({
    kind: 'api',
    url: expect.stringMatching(/\/api\/testing\/createMockInteraction$/),
  })
  expect(violations).toEqual([])
})
