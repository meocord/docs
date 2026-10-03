import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { paths } from '../scripts/lib/layout'
import type { LiveRoutes } from '../scripts/lib/live-routes'
import { VERSIONS } from '../src/config/versions'
import { canonicalDocsPath } from '../src/lib/urls'

// Every URL the deployed site answers still answers: a page, or at most two redirects that end at one
const ROUTES = JSON.parse(readFileSync(paths.liveRoutes, 'utf8')) as LiveRoutes
const MAX_HOPS = 2
const CHUNK = 250
// Where a latest URL leads changes when another line becomes current, so only an exact version's page, which always
// belongs to its line, may move it permanently
const LATEST = /^\/docs\/latest(?:\/|$)/
const EXACT_VERSION = /^\/docs\/latest\/api\/\d+\.\d+\.\d+/
// A page that answers 200 and then sends its reader on, from a redirect thrown after the response began: a moved URL
// served as a second copy of a page
const CLIENT_REDIRECT = /NEXT_REDIRECT;|<meta[^>]*(?:id="__next-page-redirect"|http-equiv="refresh")/i

/** Where a URL ends, following its redirects by hand, or the problem when it ends anywhere but a page. */
async function follow(request: APIRequestContext, start: string): Promise<{ end: string } | { problem: string }> {
  const seen = [start]
  let url = start
  for (;;) {
    const response = await request.get(url, { maxRedirects: 0 })
    const status = response.status()
    if (status === 200) {
      if (CLIENT_REDIRECT.test(await response.text()))
        return { problem: `${seen.join(' → ')} answers 200 and redirects in the page` }
      return { end: url }
    }
    const location = response.headers()['location']
    if (status < 300 || status >= 400 || !location) return { problem: `${seen.join(' → ')} answers ${status}` }
    if ((status === 301 || status === 308) && LATEST.test(url) && !EXACT_VERSION.test(url))
      return { problem: `${seen.join(' → ')} moves a latest URL permanently (${status})` }
    url = new URL(location, new URL(url, 'http://site')).pathname
    if (seen.includes(url)) return { problem: `${[...seen, url].join(' → ')} loops` }
    seen.push(url)
    if (seen.length - 1 > MAX_HOPS) return { problem: `${seen.join(' → ')} takes more than ${MAX_HOPS} redirects` }
  }
}

async function problemOf(request: APIRequestContext, start: string): Promise<string | undefined> {
  const answer = await follow(request, start)
  return 'problem' in answer ? answer.problem : undefined
}

// A deployed redirect still ends at a page, and one that sent a reader to the topic's page never
// sends them to a page saying the line lacks it
test(`the ${ROUTES.redirects.length} deployed redirects, from ${ROUTES.commit.slice(0, 7)}, still end at their topic`, async ({
  request,
}) => {
  const problems: string[] = []
  for (const { source, destination } of ROUTES.redirects) {
    // Still a redirect, unless the source has become the one URL of a page, as a latest path does when its line is current
    const first = await request.get(source, { maxRedirects: 0 })
    if (first.status() === 200 && (canonicalDocsPath(source, VERSIONS) !== source || source.includes('/missing/')))
      problems.push(`${source} redirected, and now answers 200 itself`)
    const answer = await follow(request, source)
    if ('problem' in answer) problems.push(answer.problem)
    else if (answer.end.includes('/missing/') && !destination.includes('/missing/'))
      problems.push(`${source} went to ${destination}, and now to ${answer.end}`)
  }
  expect(problems).toEqual([])
})

for (let at = 0; at < ROUTES.paths.length; at += CHUNK) {
  const chunk = ROUTES.paths.slice(at, at + CHUNK)
  test(`the deployed URLs ${at + 1}–${at + chunk.length} of ${ROUTES.paths.length}, from ${ROUTES.commit.slice(0, 7)}, still answer`, async ({
    request,
  }) => {
    const problems: string[] = []
    // A few at a time, as a crawler would ask
    for (let next = 0; next < chunk.length; next += 8) {
      const answers = await Promise.all(chunk.slice(next, next + 8).map(path => problemOf(request, path)))
      problems.push(...answers.filter((problem): problem is string => problem !== undefined))
    }
    expect(problems).toEqual([])
  })
}
