import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { docsLinks, linkProblem, textsUnder } from '../scripts/lib/meocord-links'
import manifest from '../versions.json'

// Each line's examples pin an exact meocord; its shipped declarations are what editors show on hover.
const pinned = manifest.lines
  .map(({ line }) => ({ line, types: path.join('examples', line, 'node_modules', 'meocord', 'dist', 'types') }))
  .filter(({ line }) => existsSync(path.join('examples', line, 'package.json')))

test("every docs link in the pinned meocord's declarations resolves on the site", async ({ request }) => {
  const problems: string[] = []
  for (const { line, types } of pinned) {
    expect(existsSync(types), `examples/${line} has meocord installed`).toBe(true)
    for (const link of docsLinks(textsUnder(types, ['.d.ts', '.d.cts']))) {
      const response = await request.get(link.split('#')[0])
      const problem = linkProblem(link, response.status(), await response.text())
      if (problem) problems.push(`meocord in examples/${line}: ${problem}`)
    }
  }
  expect(problems).toEqual([])
})

test('an aliased Guide slug lands on the page that holds its topic', async ({ request }) => {
  const response = await request.get('/docs/4.1/slash-commands', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe('/docs/4.1/command-types')
  // A line without the topic's page says where it is instead.
  const older = await request.get('/docs/4.0/components', { maxRedirects: 0 })
  expect(older.headers().location).toBe('/docs/4.0/missing/component-routing')
})
