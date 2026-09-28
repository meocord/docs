/**
 * What Next may spend prerendering a page, in milliseconds of a worker's time: the build's time, times the
 * workers sharing it, over the pages. CI's builds ran 130 to 230 (2,348 and 2,596 pages on 3 workers), so this
 * leaves room for a slow runner and trips when pages render slower, not when versions add pages.
 */
export const PAGE_BUDGET_WORKER_MS = 300

const UNIT_SECONDS: Record<string, number> = { ms: 0.001, s: 1, min: 60 }

export interface StaticGeneration {
  pages: number
  workers: number
  seconds: number
}

/**
 * Next's summary of its prerender, from a build log: the last "Generating static pages using N workers
 * (P/P) in T" line, with T in milliseconds, seconds or, past two minutes, minutes. Undefined when the log
 * has none. Next logs no time per page, so the cost of one slow page shows only in the average.
 */
export function staticGeneration(log: string): StaticGeneration | undefined {
  const matches = [
    ...log.matchAll(/Generating static pages using (\d+) workers \((\d+)\/\2\) in ([\d.]+)(ms|s|min)\b/g),
  ]
  const last = matches.at(-1)
  if (!last) return undefined
  const value = Number(last[3])
  return {
    workers: Number(last[1]),
    pages: Number(last[2]),
    seconds: Math.round(value * UNIT_SECONDS[last[4]] * 1000) / 1000,
  }
}

/** A worker's milliseconds a page took to prerender, on average. */
export const pageCost = ({ pages, workers, seconds }: StaticGeneration) => (seconds * 1000 * workers) / pages

/** The summary the check prints, and whether the prerender was over its budget a page. */
export function staticGenerationReport(found: StaticGeneration): { summary: string; over: boolean } {
  const cost = pageCost(found)
  return {
    summary: `${found.pages} pages prerendered in ${found.seconds.toFixed(1)} s on ${found.workers} workers: ${Math.round(cost)} worker-ms a page (budget ${PAGE_BUDGET_WORKER_MS})`,
    over: cost > PAGE_BUDGET_WORKER_MS,
  }
}
