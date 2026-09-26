import { gzipSync } from 'node:zlib'
import { chromium, expect, test } from '@playwright/test'
import lighthouse from 'lighthouse'
import desktop from 'lighthouse/core/config/desktop-config.js'
import { calculatorSlowdown, cpuSlowdownFor } from '../scripts/lib/cpu-slowdown'
import { e2ePort } from './port'

// The longest guide, one with code near its top, an API page and the changelog as well as home.
const PAGES = ['/', '/docs/4.1/defer', '/docs/4.1/testing', '/docs/4.1/api/core/ShardContext', '/docs/4.1/changelog']

/**
 * The largest-paint budgets the site holds in CI: on Lighthouse's desktop and mobile presets, which
 * simulate the page's load from a trace, and on the mobile preset with its throttling applied to a
 * real load in the browser (`applied`), which Lighthouse measures rather than models.
 */
const LCP_MS = { desktop: 1800, mobile: 3000, applied: 1800 }
/** Where the applied figure should get to on the target phone; each run prints it beside the budget. */
const APPLIED_TARGET_MS = 1500
/**
 * Lighthouse's simulated LCP falls on one of a few values for the same build, a few hundred
 * milliseconds apart, depending on how the page's tasks happened to order. Each figure is the median
 * of five runs, so no single run's value decides it. An applied run is a real throttled load, whose
 * LCP varies by tens of milliseconds and takes several times as long, so it takes three.
 */
const RUNS = { desktop: 5, mobile: 5, applied: 3 }

// Lighthouse drives its own Chromium over the debugging protocol, one page at a time.
test.describe.configure({ mode: 'serial' })

const COMPRESSIBLE = /text|javascript|json|css|svg|x-component/

/**
 * A gzip hop in front of the served build, standing for Cloudflare, which compresses what readers
 * download. The CSP proxy asks Next for uncompressed bodies to hash them, so without this the pages
 * would be measured at several times the bytes a reader downloads.
 */
function compressing(upstream: string) {
  return Bun.serve({
    port: e2ePort() + 3,
    async fetch(request) {
      const url = new URL(request.url)
      const response = await fetch(new URL(url.pathname + url.search, upstream), {
        headers: request.headers,
        redirect: 'manual',
      })
      const headers = new Headers(response.headers)
      const type = headers.get('content-type') ?? ''
      if (!COMPRESSIBLE.test(type) || !(request.headers.get('accept-encoding') ?? '').includes('gzip')) {
        return new Response(response.body, { status: response.status, headers })
      }
      const body = gzipSync(new Uint8Array(await response.arrayBuffer()))
      headers.set('content-encoding', 'gzip')
      headers.set('content-length', String(body.byteLength))
      headers.delete('transfer-encoding')
      return new Response(body, { status: response.status, headers })
    },
  })
}

/** What moved, for a failure to name: each shift's element and, when Lighthouse knows it, its cause. */
function layoutShifts(audit: { details?: unknown } | undefined): string[] {
  const items = (audit?.details as { items?: LayoutShift[] } | undefined)?.items ?? []
  return items.map(item => {
    const causes = (item.subItems?.items ?? []).map(cause => cause.extra?.value ?? cause.cause).filter(Boolean)
    return `${item.score?.toFixed(4)} ${item.node?.selector ?? 'unknown element'}${causes.length ? ` (${causes.join(', ')})` : ''}`
  })
}

/** How each shifted box moved, from the trace: where it was and where it went, as [x, y, width, height]. */
function shiftedBoxes(trace: { traceEvents?: TraceEvent[] } | undefined): string[] {
  return (trace?.traceEvents ?? [])
    .filter(event => event.name === 'LayoutShift' && !event.args?.data?.had_recent_input)
    .flatMap(event =>
      (event.args?.data?.impacted_nodes ?? []).map(
        node => `moved ${JSON.stringify(node.old_rect)} to ${JSON.stringify(node.new_rect)}`,
      ),
    )
}

interface TraceEvent {
  name?: string
  args?: {
    data?: { had_recent_input?: boolean; impacted_nodes?: { old_rect?: number[]; new_rect?: number[] }[] }
  }
}

interface LayoutShift {
  score?: number
  node?: { selector?: string }
  subItems?: { items?: { cause?: string; extra?: { value?: string } }[] }
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

type Run = NonNullable<Awaited<ReturnType<typeof lighthouse>>>

/** Runs Lighthouse `runs` times on `url` in a fresh Chromium, with the given flags and config. */
async function lighthouseRuns(url: string, runs: number, flags: Parameters<typeof lighthouse>[1], config?: object) {
  const port = e2ePort() + 2
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] })
  try {
    const results: Run[] = []
    for (let run = 0; run < runs; run += 1) {
      const result = await lighthouse(url, { port, output: 'json', logLevel: 'error', ...flags }, config)
      if (!result || result.lhr.runtimeError) {
        throw new Error(`Lighthouse failed on ${url}: ${result?.lhr.runtimeError?.message}`)
      }
      results.push(result)
    }
    return results
  } finally {
    await browser.close()
  }
}

/**
 * The applied runs' CPU slowdown, set once per run of this spec from the host's `benchmarkIndex`, so
 * that throttled CPU means Lighthouse's target phone on a fast laptop and on a slow CI runner alike.
 */
let slowdown = 4
/** The host's `benchmarkIndex` that set it. */
let benchmarkIndex = 0

async function measure(url: string, preset: keyof typeof LCP_MS) {
  const results = await lighthouseRuns(
    url,
    RUNS[preset],
    preset === 'applied'
      ? {
          onlyCategories: ['performance'],
          throttlingMethod: 'devtools',
          throttling: { cpuSlowdownMultiplier: slowdown },
        }
      : { onlyCategories: ['performance'], throttlingMethod: 'simulate' },
    preset === 'desktop' ? desktop : undefined,
  )
  const lcp = results.map(result => result.lhr.audits['largest-contentful-paint'].numericValue ?? Infinity)
  const cls = results.map(result => result.lhr.audits['cumulative-layout-shift'].numericValue ?? Infinity)
  const shifts = results.flatMap(result => [
    ...layoutShifts(result.lhr.audits['layout-shifts']),
    ...shiftedBoxes(result.artifacts?.Trace as { traceEvents?: TraceEvent[] } | undefined),
  ])
  return { lcp: median(lcp), runs: lcp, cls: Math.max(...cls), shifts: [...new Set(shifts)] }
}

let hop: ReturnType<typeof compressing>
test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(120_000)
  hop = compressing(baseURL!)
  // Lighthouse measures the host on every run; the median of three short runs sets the slowdown.
  const runs = await lighthouseRuns(`http://localhost:${hop.port}/`, 3, { onlyAudits: ['first-contentful-paint'] })
  const indexes = runs.map(run => run.lhr.environment.benchmarkIndex)
  benchmarkIndex = median(indexes)
  slowdown = cpuSlowdownFor(benchmarkIndex)
  console.log(
    `[lighthouse] host benchmarkIndex ${benchmarkIndex} (${indexes.join(', ')}); applied cpuSlowdownMultiplier ${slowdown.toFixed(2)}` +
      (slowdown < calculatorSlowdown(benchmarkIndex)
        ? `, capped (the calculator gives ${calculatorSlowdown(benchmarkIndex).toFixed(2)})`
        : ''),
  )
})
test.afterAll(() => hop?.stop(true))

for (const path of PAGES) {
  test(`${path} paints its largest content within ${LCP_MS.desktop} ms on desktop, ${LCP_MS.mobile} ms on mobile and ${LCP_MS.applied} ms on mobile with applied throttling, without layout shift`, async () => {
    test.setTimeout(600_000)
    const url = `http://localhost:${hop.port}${path}`
    const { lcp, runs, cls, shifts: desktopShifts } = await measure(url, 'desktop')
    const mobile = await measure(url, 'mobile')
    const applied = await measure(url, 'applied')
    const each = (values: number[]) => values.map(Math.round).join(', ')
    const summary =
      `desktop LCP ${Math.round(lcp)} ms (${each(runs)}), CLS ${cls}; ` +
      `mobile LCP ${Math.round(mobile.lcp)} ms (${each(mobile.runs)}), CLS ${mobile.cls}; ` +
      `applied LCP ${Math.round(applied.lcp)} ms at ${slowdown.toFixed(2)}x CPU for benchmarkIndex ${benchmarkIndex} (${each(applied.runs)}), ` +
      `budget ${LCP_MS.applied} ms, target ${APPLIED_TARGET_MS} ms, CLS ${applied.cls}`
    test.info().annotations.push({ type: 'lighthouse', description: summary })
    console.log(`[lighthouse] ${path}: ${summary}`)
    expect(lcp, 'desktop LCP (ms)').toBeLessThan(LCP_MS.desktop)
    expect(cls, `desktop CLS: ${desktopShifts.join('; ')}`).toBe(0)
    expect(mobile.lcp, 'mobile LCP (ms)').toBeLessThan(LCP_MS.mobile)
    expect(mobile.cls, `mobile CLS: ${mobile.shifts.join('; ')}`).toBe(0)
    expect(applied.lcp, 'mobile LCP with applied throttling (ms)').toBeLessThanOrEqual(LCP_MS.applied)
    expect(applied.cls, `mobile CLS with applied throttling: ${applied.shifts.join('; ')}`).toBe(0)
  })
}
