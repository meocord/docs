import { gzipSync } from 'node:zlib'
import { chromium, expect, test } from '@playwright/test'
import lighthouse from 'lighthouse'
import desktop from 'lighthouse/core/config/desktop-config.js'
import { e2ePort } from './port'

// The longest guide, one with code near its top, an API page and the changelog as well as home.
const PAGES = ['/', '/docs/4.1/defer', '/docs/4.1/testing', '/docs/4.1/api/core/ShardContext', '/docs/4.1/changelog']

/** The largest-paint budgets the site holds in CI, on Lighthouse's desktop and mobile presets. */
const LCP_MS = { desktop: 1800, mobile: 3000 }
/** Lighthouse varies by a few hundred milliseconds from run to run, so each figure is a median. */
const RUNS = 3

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

async function measure(url: string, preset: 'desktop' | 'mobile') {
  const port = e2ePort() + 2
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] })
  try {
    const lcp: number[] = []
    const cls: number[] = []
    const shifts: string[] = []
    for (let run = 0; run < RUNS; run += 1) {
      const result = await lighthouse(
        url,
        { port, output: 'json', logLevel: 'error', onlyCategories: ['performance'] },
        preset === 'desktop' ? desktop : undefined,
      )
      if (!result || result.lhr.runtimeError) {
        throw new Error(`Lighthouse failed on ${url}: ${result?.lhr.runtimeError?.message}`)
      }
      lcp.push(result.lhr.audits['largest-contentful-paint'].numericValue ?? Infinity)
      cls.push(result.lhr.audits['cumulative-layout-shift'].numericValue ?? Infinity)
      shifts.push(
        ...layoutShifts(result.lhr.audits['layout-shifts']),
        ...shiftedBoxes(result.artifacts?.Trace as { traceEvents?: TraceEvent[] } | undefined),
      )
    }
    return { lcp: median(lcp), cls: Math.max(...cls), shifts: [...new Set(shifts)] }
  } finally {
    await browser.close()
  }
}

let hop: ReturnType<typeof compressing>
test.beforeAll(({ baseURL }) => {
  hop = compressing(baseURL!)
})
test.afterAll(() => hop?.stop(true))

for (const path of PAGES) {
  test(`${path} paints its largest content within ${LCP_MS.desktop} ms on desktop and ${LCP_MS.mobile} ms on mobile, without layout shift`, async () => {
    test.setTimeout(240_000)
    const url = `http://localhost:${hop.port}${path}`
    const { lcp, cls, shifts: desktopShifts } = await measure(url, 'desktop')
    const mobile = await measure(url, 'mobile')
    const summary = `desktop LCP ${Math.round(lcp)} ms, CLS ${cls}; mobile LCP ${Math.round(mobile.lcp)} ms, CLS ${mobile.cls}`
    test.info().annotations.push({ type: 'lighthouse', description: summary })
    console.log(`[lighthouse] ${path}: ${summary}`)
    expect(lcp, 'desktop LCP (ms)').toBeLessThan(LCP_MS.desktop)
    expect(cls, `desktop CLS: ${desktopShifts.join('; ')}`).toBe(0)
    expect(mobile.lcp, 'mobile LCP (ms)').toBeLessThan(LCP_MS.mobile)
    expect(mobile.cls, `mobile CLS: ${mobile.shifts.join('; ')}`).toBe(0)
  })
}
