/**
 * Starts `next dev` briefly, from a cold cache, and loads the home page and one page of every docs
 * route, by its line and through `latest`,
 * failing on a non-200 answer or on a validation error in the dev log, such as a route blocking on
 * runtime data during prerender. The production build does not run these checks; `next dev` does, and
 * shows their errors to anyone working on the site.
 *
 *   bun run check:dev-routes
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { e2ePort } from './port'
import { CURRENT_LINE } from '../src/config/versions'
import * as guide from '../src/app/docs/[line]/[slug]/page'
import * as landing from '../src/app/docs/[line]/page'
import * as api from '../src/app/docs/[line]/api/[...path]/page'
import * as changelog from '../src/app/docs/[line]/changelog/page'
import * as migrating from '../src/app/docs/[line]/migrating/page'
import * as missing from '../src/app/docs/[line]/missing/[id]/page'

type Params = Record<string, string | string[]>

/** Each route's pattern, and the params it prerenders. */
const ROUTES: [pattern: string, params: () => Params[] | Promise<Params[]>][] = [
  ['/docs/[line]', landing.generateStaticParams],
  ['/docs/[line]/[slug]', guide.generateStaticParams],
  ['/docs/[line]/api/[...path]', api.generateStaticParams],
  ['/docs/[line]/changelog', changelog.generateStaticParams],
  ['/docs/[line]/migrating', migrating.generateStaticParams],
  ['/docs/[line]/missing/[id]', missing.generateStaticParams],
]

// A validation or module-loading error from the dev server, as its log prints one.
const PROBLEM =
  /encountered runtime data during prerendering|blocking-prerender|Error: Route "|Failed to load external module/

// Its own port, beside the e2e server's pair, so both can run from one checkout.
const PORT = Number(process.env.DEV_CHECK_PORT ?? e2ePort() + 2)
const ORIGIN = `http://localhost:${PORT}`

function fill(pattern: string, params: Params): string {
  return pattern.replace(/\[(?:\.\.\.)?(\w+)\]/g, (_, name: string) => {
    const value = params[name]
    return Array.isArray(value) ? value.map(encodeURIComponent).join('/') : encodeURIComponent(value)
  })
}

/** One URL per route by its line, plus the same route through `latest` when a current-line page exists. */
async function urls(): Promise<string[]> {
  const found: string[] = []
  for (const [pattern, generate] of ROUTES) {
    const params = await generate()
    if (params.length === 0) throw new Error(`${pattern} prerenders nothing.`)
    found.push(fill(pattern, params[0]))
    const current = params.find(entry => entry.line === CURRENT_LINE)
    if (current) found.push(fill(pattern, { ...current, line: 'latest' }))
  }
  // The home page, which highlights code above the fold.
  return ['/', ...new Set(found)]
}

async function waitForServer(log: () => string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(`${ORIGIN}/api/health`)).ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error(`next dev did not answer on ${ORIGIN}.\n${log()}`)
}

const targets = await urls()
// Cold, as `bun run start:dev` starts: a warm cache serves pages without loading what renders them.
// The same empty node_modules too, where Next links the packages it keeps external.
for (const dir of ['.next/dev', '.next/cache']) rmSync(dir, { recursive: true, force: true })
mkdirSync('.next/dev/node_modules', { recursive: true })
const child = spawn('bun', ['--bun', 'next', 'dev', '-p', String(PORT)], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
})
let output = ''
child.stdout.on('data', chunk => (output += chunk))
child.stderr.on('data', chunk => (output += chunk))

const failures: string[] = []
try {
  await waitForServer(() => output)
  let home = ''
  const check = async (url: string) => {
    const before = output.length
    const response = await fetch(ORIGIN + url)
    const body = await response.text()
    // Validation reports after the response; give it a moment to reach the log.
    await new Promise(resolve => setTimeout(resolve, 1500))
    const logged = output.slice(before)
    const problem = logged
      .split('\n')
      .find(line => PROBLEM.test(line))
      ?.trim()
    const verdict = response.status !== 200 ? `answered ${response.status}${problem ? `: ${problem}` : ''}` : problem
    console.log(`${verdict ? 'FAIL' : 'ok  '}  ${url}${verdict ? `  ${verdict}` : ''}`)
    if (verdict) failures.push(`${url}: ${verdict}`)
    return body
  }
  for (const url of targets) {
    const body = await check(url)
    if (url === '/') home = body
  }
  // The home page's OG card, which loads meo-canvas, the other package kept external.
  const card = /<meta property="og:image" content="([^"]+)"/.exec(home)?.[1]
  if (card) await check(new URL(card).pathname)
  else failures.push('/: names no og:image')
} finally {
  // The dev server and everything it started, as one process group.
  try {
    process.kill(-child.pid!, 'SIGTERM')
  } catch {
    // Already gone.
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} route(s) failed under next dev:\n${failures.join('\n')}`)
  process.exit(1)
}
console.log(`\nAll ${targets.length} pages load cleanly under next dev.`)
