import { mkdirSync, appendFileSync } from 'node:fs'
import { chromium, test } from '@playwright/test'
import lighthouse from 'lighthouse'
import { calculatorSlowdown, cpuSlowdownFor } from '../scripts/lib/cpu-slowdown'
import { type EdgeHop, edgeHop } from './edge-hop'
import { docs41 } from './lines'
import { e2ePort } from './port'

// Where the applied LCP of the two pages nearest the gate goes: one JSON line per run, for docs#324.
const PAGES = [`${docs41}/changelog/4.1.0-beta.0`, `${docs41}/testing`]
const RUNS = Number(process.env.PERF_DETAIL_RUNS ?? 3)
const OUT_DIR = 'e2e-results'
const OUT_FILE = `${OUT_DIR}/perf-detail.jsonl`

test.describe.configure({ mode: 'serial' })
test.skip(!process.env.PERF_DETAIL, 'A measurement, run only with PERF_DETAIL set')

type Run = NonNullable<Awaited<ReturnType<typeof lighthouse>>>
type Items = Record<string, unknown>[]

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const items = (run: Run, audit: string): Items =>
  ((run.lhr.audits[audit]?.details as { items?: Items } | undefined)?.items ?? []) as Items
const ms = (value: unknown) => Math.round(Number(value ?? 0))

async function lighthouseRuns(url: string, runs: number, flags: Parameters<typeof lighthouse>[1]) {
  const port = e2ePort() + 2
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`, '--ignore-certificate-errors'] })
  try {
    const results: Run[] = []
    for (let run = 0; run < runs; run += 1) {
      const result = await lighthouse(url, { port, output: 'json', logLevel: 'error', ...flags })
      if (!result || result.lhr.runtimeError) throw new Error(`Lighthouse failed: ${result?.lhr.runtimeError?.message}`)
      results.push(result)
    }
    return results
  } finally {
    await browser.close()
  }
}

/** The LCP subparts, from the breakdown insight's first table. */
function lcpBreakdown(run: Run) {
  const details = run.lhr.audits['lcp-breakdown-insight']?.details as
    { items?: { type?: string; items?: Items; selector?: string }[] } | undefined
  const table = details?.items?.find(item => item.type === 'table')
  const node = details?.items?.find(item => item.type === 'node')
  const parts = Object.fromEntries((table?.items ?? []).map(item => [String(item.subpart), ms(item.duration)]))
  return { element: node?.selector ?? null, ...parts }
}

/** Main-thread time by group, as Lighthouse sums it over the load. */
function mainThread(run: Run) {
  return Object.fromEntries(
    items(run, 'mainthread-work-breakdown').map(item => [String(item.group), ms(item.duration)]),
  )
}

/** Script time of the document itself, which is where the inline flight scripts are counted. */
function documentScripts(run: Run, url: string) {
  const own = items(run, 'bootup-time').find(item => item.url === url)
  return own ? { total: ms(own.total), scripting: ms(own.scripting), parseCompile: ms(own.scriptParseCompile) } : null
}

/** The document's bytes on the wire and decoded. */
function documentSize(run: Run, url: string) {
  const own = items(run, 'network-requests').find(item => item.url === url)
  return own ? { transfer: Number(own.transferSize), resource: Number(own.resourceSize) } : null
}

/** A request as a path only, so no line names a host: `external` marks one from another origin. */
function where(url: unknown, origin: string) {
  const parsed = new URL(String(url))
  return parsed.origin === origin ? { path: parsed.pathname } : { path: parsed.pathname, external: true }
}

/** The requests that started before first paint, in order, times from the first request in ms. */
function waterfallToFcp(run: Run, origin: string, fcp: number) {
  return items(run, 'network-requests')
    .filter(item => Number(item.networkRequestTime) < fcp)
    .sort((a, b) => Number(a.networkRequestTime) - Number(b.networkRequestTime))
    .map(item => ({
      ...where(item.url, origin),
      type: item.resourceType,
      priority: item.priority,
      start: ms(item.networkRequestTime),
      end: ms(item.networkEndTime),
      transfer: Number(item.transferSize ?? 0),
      preload: item.isLinkPreload === true || undefined,
    }))
}

/** What Lighthouse counts as render-blocking, with the time it says each one holds the first paint. */
function renderBlocking(run: Run, origin: string) {
  const details = run.lhr.audits['render-blocking-insight']?.details as { items?: Items } | undefined
  return (details?.items ?? []).map(item => ({
    ...where(item.url, origin),
    bytes: Number(item.totalBytes ?? 0),
    wastedMs: ms(item.wastedMs),
  }))
}

interface TraceEvent {
  name?: string
  ph?: string
  ts?: number
  dur?: number
  pid?: number
  tid?: number
}

/** Trace events whose main-thread time before first paint the line sums, by name. */
const BEFORE_FCP_EVENTS = [
  'RunTask',
  'ParseHTML',
  'ParseAuthorStyleSheet',
  'EvaluateScript',
  'v8.compile',
  'v8.compileModule',
  'FunctionCall',
  'UpdateLayoutTree',
  'Layout',
  'PrePaint',
  'Paint',
  'Layerize',
  'MajorGC',
  'MinorGC',
]

/**
 * Main-thread time between navigation and first paint, from the trace: each named event's time clipped to
 * that window on the thread that painted, and `RunTask`, the top-level tasks, as the busy total.
 */
function mainThreadBeforeFcp(run: Run) {
  const events = (run.artifacts?.Trace as { traceEvents?: TraceEvent[] } | undefined)?.traceEvents ?? []
  const fcp = events.find(event => event.name === 'firstContentfulPaint')
  if (!fcp?.ts) return null
  const start = events
    .filter(event => event.name === 'navigationStart' && event.pid === fcp.pid && (event.ts ?? 0) <= fcp.ts!)
    .reduce((latest, event) => Math.max(latest, event.ts ?? 0), 0)
  const sums: Record<string, number> = {}
  for (const event of events) {
    if (
      event.ph !== 'X' ||
      event.pid !== fcp.pid ||
      event.tid !== fcp.tid ||
      !BEFORE_FCP_EVENTS.includes(event.name ?? '')
    )
      continue
    const clipped = Math.min((event.ts ?? 0) + (event.dur ?? 0), fcp.ts) - Math.max(event.ts ?? 0, start)
    if (clipped > 0) sums[event.name!] = (sums[event.name!] ?? 0) + clipped / 1000
  }
  const window = (fcp.ts - start) / 1000
  return {
    window: ms(window),
    idle: ms(window - (sums.RunTask ?? 0)),
    ...Object.fromEntries(Object.entries(sums).map(([name, value]) => [name, ms(value)])),
  }
}

let hop: EdgeHop
let slowdown = 4
let benchmarkIndex = 0
test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(120_000)
  hop = await edgeHop(baseURL!, e2ePort() + 3)
  const runs = await lighthouseRuns(`${hop.origin}/`, 3, { onlyAudits: ['first-contentful-paint'] })
  benchmarkIndex = median(runs.map(run => run.lhr.environment.benchmarkIndex))
  slowdown = cpuSlowdownFor(benchmarkIndex)
  mkdirSync(OUT_DIR, { recursive: true })
})
test.afterAll(() => hop?.close())

for (const path of PAGES) {
  test(`${path}: where the applied LCP goes`, { tag: '@performance-detail' }, async () => {
    test.setTimeout(900_000)
    const url = `${hop.origin}${path}`
    const runs = await lighthouseRuns(url, RUNS, {
      onlyCategories: ['performance'],
      throttlingMethod: 'devtools',
      throttling: { cpuSlowdownMultiplier: slowdown },
    })
    runs.forEach((run, index) => {
      const line = {
        path,
        run: index + 1,
        benchmarkIndex,
        runBenchmarkIndex: run.lhr.environment.benchmarkIndex,
        calculatorSlowdown: Number(calculatorSlowdown(benchmarkIndex).toFixed(2)),
        appliedSlowdown: Number(slowdown.toFixed(2)),
        fcp: ms(run.lhr.audits['first-contentful-paint'].numericValue),
        lcp: ms(run.lhr.audits['largest-contentful-paint'].numericValue),
        tbt: ms(run.lhr.audits['total-blocking-time'].numericValue),
        lcpBreakdown: lcpBreakdown(run),
        mainThread: mainThread(run),
        documentScripts: documentScripts(run, url),
        documentSize: documentSize(run, url),
        throttling: { method: run.lhr.configSettings.throttlingMethod, ...run.lhr.configSettings.throttling },
        renderBlocking: renderBlocking(run, hop.origin),
        mainThreadBeforeFcp: mainThreadBeforeFcp(run),
        waterfallToFcp: waterfallToFcp(run, hop.origin, run.lhr.audits['first-contentful-paint'].numericValue ?? 0),
      }
      appendFileSync(OUT_FILE, `${JSON.stringify(line)}\n`)
      console.log(`[perf-detail] ${JSON.stringify(line)}`)
    })
  })
}
