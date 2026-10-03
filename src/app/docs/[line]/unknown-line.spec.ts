import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'

// Every route below /docs/[line], found on disk, so a route added later is held to the same answer
const ROUTES = (readdirSync(import.meta.dirname, { recursive: true }) as string[])
  .filter(file => path.basename(file) === 'page.ts')
  .sort()

// What each route's other params may hold; the line is the one unknown part
const params = { line: '9.9', slug: ['guards'], path: ['decorators', 'Defer'], version: '9.9.0', id: 'guards' }

const isNotFound = (error: unknown) => (error as { digest?: unknown })?.digest === 'NEXT_HTTP_ERROR_FALLBACK;404'

describe('a line versions.json does not list', () => {
  it('reaches every route', () => {
    expect(ROUTES).toContain('page.ts')
    expect(ROUTES).toContain(path.join('[...slug]', 'page.ts'))
  })

  it.each(ROUTES)('is a 404 in %s, for its metadata and its page', async route => {
    const routeModule = (await import(`./${route}`)) as {
      generateMetadata?: (props: { params: Promise<typeof params> }) => Promise<unknown>
      default: (props: { params: Promise<typeof params> }) => Promise<unknown>
    }
    for (const run of [routeModule.generateMetadata, routeModule.default]) {
      if (!run) continue
      const error = await run({ params: Promise.resolve(params) }).then(
        () => undefined,
        (thrown: unknown) => thrown,
      )
      expect(isNotFound(error), String(error)).toBe(true)
    }
  })
})
