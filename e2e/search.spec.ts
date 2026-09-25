import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
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
  count: number
  results: { url: string; title?: string; kind?: string[]; line?: string[]; sub: string[] }[]
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

  const found = (await page.evaluate(async base => {
    const pagefind = await import(/* @vite-ignore */ `${base}pagefind.js`)
    await pagefind.options({ basePath: base })
    const search = await pagefind.search('cooldown')
    const results = await Promise.all(
      search.results.slice(0, 10).map(async (result: { data: () => Promise<PagefindData> }) => {
        const data = await result.data()
        return {
          url: data.url,
          title: data.meta?.title,
          kind: data.filters?.kind,
          line: data.filters?.line,
          sub: (data.sub_results ?? []).map(sub => sub.url),
        }
      }),
    )
    return { count: search.results.length, results }
  }, prerelease.search)) as Found

  expect(found.count).toBeGreaterThan(0)
  expect(found.results.every(result => result.line?.[0] === prerelease.line)).toBe(true)
  const api = found.results.find(result => result.kind?.[0] === 'api')
  expect(api?.url).toMatch(new RegExp(`^/docs/(${prerelease.line}|latest)/api/[a-z]+/\\w+$`))
  const guide = found.results.find(result => result.kind?.[0] === 'guide' && result.sub.some(url => url.includes('#')))
  expect(guide, 'a guide result with a section sub-result').toBeDefined()
  expect(guide!.title).toBeTruthy()
  expect(violations).toEqual([])
})
