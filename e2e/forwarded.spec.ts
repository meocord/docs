import { readFileSync } from 'node:fs'
import http from 'node:http'
import { computeCacheBustingSearchParam } from 'next/dist/shared/lib/router/utils/cache-busting-search-param'
import { expect, test } from './test'
import { CURRENT_LINE, VERSIONS } from '../src/config/versions'
import { EXACT_ROUTES_FILE, type ExactRoutes } from '../src/lib/docs/exact-routes'
import { e2ePort } from './port'

// What an edge that terminates TLS sends on: the scheme and host the reader used, which Next's server does not listen on
const FORWARDED = {
  host: 'docs.example',
  'x-forwarded-host': 'docs.example',
  'x-forwarded-proto': 'https',
  'x-forwarded-for': '203.0.113.7',
}

/**
 * An exact version's page served by another version's, and one that serves itself, from the routes the build used. Both
 * are in an archived line, addressed by its number, so the proxy rewrites them or lets them through and never redirects.
 */
function exactPages(): { rewritten: string; own: string } {
  const routes = JSON.parse(readFileSync(EXACT_ROUTES_FILE, 'utf8')) as ExactRoutes
  const archived = new Set(VERSIONS.lines.filter(entry => entry.status === 'archived').map(entry => entry.line))
  let rewritten: string | undefined
  let own: string | undefined
  for (const [line, { versions, servedBy }] of Object.entries(routes)) {
    if (!archived.has(line)) continue
    for (const [page, served] of Object.entries(servedBy)) {
      served.forEach((by, at) => {
        const path = `/docs/${line}/api/${versions[at]}/${page}`
        if (by >= 0 && by !== at) rewritten ??= path
        if (by === at) own ??= path
      })
    }
  }
  if (!rewritten || !own)
    throw new Error(`${EXACT_ROUTES_FILE} has no shared and no own exact page in an archived line`)
  return { rewritten, own }
}

/** The server's answer to `path` as the edge forwards it, unfollowed. */
function forwarded(path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.get({ host: 'localhost', port: e2ePort(), path, headers: { ...FORWARDED, ...headers } }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => (body += chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }))
    })
    req.on('error', reject)
  })
}

// A rewrite or a redirect the proxy makes must stay on Next's own server, however the request was forwarded
test.describe('a request forwarded from https', () => {
  const { rewritten, own } = exactPages()

  /** That `response` is the page Next served itself from a rewrite: not redirected, and rewritten within the server. */
  function expectRewritten(path: string, response: Awaited<ReturnType<typeof forwarded>>) {
    expect(response.status, `${path} answers ${response.status} ${response.headers.location ?? ''}`).toBe(200)
    // A relative target is one Next serves itself; an absolute one, it fetches as another site
    expect(response.headers['x-middleware-rewrite'], path).toMatch(/^\/docs\//)
  }

  test("serves an exact version's page another version's page serves", async () => {
    expectRewritten(rewritten, await forwarded(rewritten))
  })

  test("serves that page's RSC payload, as client navigation prefetches it", async () => {
    // The cache-busting value Next checks against the router's headers, as its client computes it
    const rsc = await computeCacheBustingSearchParam('1', undefined, undefined, undefined)
    const path = `${rewritten}?_rsc=${rsc}`
    const response = await forwarded(path, { rsc: '1', 'next-router-prefetch': '1' })
    expectRewritten(path, response)
    expect(response.headers['content-type']).toContain('text/x-component')
  })

  test('serves an exact version that serves its own page, with no rewrite', async () => {
    const response = await forwarded(own)
    expect(response.status, own).toBe(200)
    expect(response.headers['x-middleware-rewrite'], own).toBeUndefined()
  })

  test("redirects the current line's number URL within the site", async () => {
    const response = await forwarded(`/docs/${CURRENT_LINE}/guards`)
    expect(response.status).toBe(307)
    expect(response.headers.location).toBe('/docs/latest/guards')
  })
})
