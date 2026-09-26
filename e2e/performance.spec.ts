import { chromium, expect, test } from '@playwright/test'
import lighthouse from 'lighthouse'
import desktop from 'lighthouse/core/config/desktop-config.js'
import { calculatorSlowdown, cpuSlowdownFor } from '../scripts/lib/cpu-slowdown'
import { type EdgeHop, edgeHop } from './edge-hop'
import { e2ePort } from './port'

// The longest guide, one with code near its top, an API page and the changelog as well as home.
const PAGES = ['/', '/docs/4.1/defer', '/docs/4.1/testing', '/docs/4.1/api/core/ShardContext', '/docs/4.1/changelog']
/**
 * The pages this run measures: all of them, or with `PERF_SHARD=k/n` every n-th starting at the k-th,
 * so CI can measure them on several runners at once, each calibrated to itself.
 */
function shardOf(pages: string[], shard = process.env.PERF_SHARD): string[] {
  if (!shard) return pages
  const match = /^(\d+)\/(\d+)$/.exec(shard)
  const [k, n] = match ? [Number(match[1]), Number(match[2])] : [0, 0]
  if (!(n >= 1 && k >= 1 && k <= n)) throw new Error(`PERF_SHARD must be k/n with 1 <= k <= n, not '${shard}'.`)
  return pages.filter((_, index) => index % n === k - 1)
}

/**
 * The largest-paint budgets the site holds in CI: on Lighthouse's desktop and mobile presets, which
 * simulate the page's load from a trace, and on the mobile preset with its throttling applied to a
 * real load in the browser (`applied`), which Lighthouse measures rather than models.
 */
const LCP_MS = { desktop: 1800, mobile: 2500, applied: 1800 }
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

interface DevtoolsEvent {
  method?: string
  params?: { requestId?: string; request?: { url?: string }; errorText?: string; canceled?: boolean }
}

/**
 * The requests a load lost, from its DevTools log: each one that failed without the page cancelling
 * it, such as a script whose body did not decode. A page that lost one ran without it.
 */
function failedRequests(log: DevtoolsEvent[] | undefined): string[] {
  const urls = new Map<string, string>()
  const failed: string[] = []
  for (const event of log ?? []) {
    const id = event.params?.requestId ?? ''
    if (event.method === 'Network.requestWillBeSent') urls.set(id, event.params?.request?.url ?? '')
    if (event.method === 'Network.loadingFailed' && !event.params?.canceled) {
      failed.push(`${urls.get(id) ?? id}: ${event.params?.errorText}`)
    }
  }
  return failed
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
  // The hop's certificate is made for the run, so the browser is told to accept it.
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`, '--ignore-certificate-errors'] })
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
  // A figure from a page that lost a request is not the page's figure.
  for (const result of results) {
    const failed = failedRequests(result.artifacts?.DevtoolsLog as DevtoolsEvent[] | undefined)
    if (failed.length > 0) throw new Error(`${url} lost requests while measured on ${preset}: ${failed.join('; ')}`)
  }
  const lcp = results.map(result => result.lhr.audits['largest-contentful-paint'].numericValue ?? Infinity)
  const cls = results.map(result => result.lhr.audits['cumulative-layout-shift'].numericValue ?? Infinity)
  const shifts = results.flatMap(result => [
    ...layoutShifts(result.lhr.audits['layout-shifts']),
    ...shiftedBoxes(result.artifacts?.Trace as { traceEvents?: TraceEvent[] } | undefined),
  ])
  return { lcp: median(lcp), runs: lcp, cls: Math.max(...cls), shifts: [...new Set(shifts)] }
}

let hop: EdgeHop
test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(120_000)
  hop = await edgeHop(baseURL!, e2ePort() + 3)
  // Lighthouse measures the host on every run; the median of three short runs sets the slowdown.
  const runs = await lighthouseRuns(`${hop.origin}/`, 3, { onlyAudits: ['first-contentful-paint'] })
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
test.afterAll(() => hop?.close())

for (const path of shardOf(PAGES)) {
  test(
    `${path} paints its largest content within ${LCP_MS.desktop} ms on desktop, ${LCP_MS.mobile} ms on mobile and ${LCP_MS.applied} ms on mobile with applied throttling, without layout shift`,
    { tag: '@performance' },
    async () => {
      test.setTimeout(600_000)
      const url = `${hop.origin}${path}`
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
    },
  )
}
