/**
 * Starts `next dev` briefly and loads one page of every docs route, by its line and through `latest`,
 * failing on a non-200 answer or on a validation error in the dev log, such as a route blocking on
 * runtime data during prerender. The production build does not run these checks; `next dev` does, and
 * shows their errors to anyone working on the site.
 *
 *   bun run check:dev-routes
 */
import { spawn } from 'node:child_process'
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

// A validation error from the dev server, as its log prints one.
const PROBLEM = /encountered runtime data during prerendering|blocking-prerender|Error: Route "/

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
  return [...new Set(found)]
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
  for (const url of targets) {
    const before = output.length
    const response = await fetch(ORIGIN + url)
    await response.arrayBuffer()
    // Validation reports after the response; give it a moment to reach the log.
    await new Promise(resolve => setTimeout(resolve, 1500))
    const logged = output.slice(before)
    const problem = logged.split('\n').find(line => PROBLEM.test(line))
    const verdict = response.status !== 200 ? `answered ${response.status}` : problem ? problem.trim() : undefined
    console.log(`${verdict ? 'FAIL' : 'ok  '}  ${url}${verdict ? `  ${verdict}` : ''}`)
    if (verdict) failures.push(`${url}: ${verdict}`)
  }
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
