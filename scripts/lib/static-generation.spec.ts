import { describe, expect, it } from 'vitest'
import { PAGE_BUDGET_WORKER_MS, pageCost, staticGeneration, staticGenerationReport } from './static-generation.js'

describe('staticGeneration', () => {
  it('reads the last summary line, in seconds or milliseconds', () => {
    const log = [
      '  Generating static pages using 3 workers (500/1097) ',
      '✓ Generating static pages using 3 workers (1097/1097) in 63s',
    ].join('\n')
    expect(staticGeneration(log)).toEqual({ workers: 3, pages: 1097, seconds: 63 })
    expect(staticGeneration('✓ Generating static pages using 12 workers (7/7) in 181ms')?.seconds).toBeCloseTo(0.181)
    expect(staticGeneration('✓ Generating static pages using 13 workers (1097/1097) in 24.6s')?.seconds).toBe(24.6)
  })

  it('reads a summary Next prints in minutes, past two minutes', () => {
    expect(staticGeneration('✓ Generating static pages using 3 workers (1527/1527) in 2.1min')).toEqual({
      workers: 3,
      pages: 1527,
      seconds: 126,
    })
  })

  it('finds nothing without a finished summary', () => {
    expect(staticGeneration('Generating static pages using 3 workers (500/1097)')).toBeUndefined()
    expect(staticGeneration('')).toBeUndefined()
  })

  it('costs a page by the workers sharing the time, so more versions add pages, not cost', () => {
    const beta7 = staticGeneration('✓ Generating static pages using 3 workers (2348/2348) in 3.0min')!
    const beta8 = staticGeneration('✓ Generating static pages using 3 workers (2596/2596) in 186s')!
    expect(Math.round(pageCost(beta7))).toBe(230)
    expect(Math.round(pageCost(beta8))).toBe(215)
    // 2,596 pages in 186 s, a slow runner, is within the budget a page
    expect(staticGenerationReport(beta8)).toEqual({
      summary: '2596 pages prerendered in 186.0 s on 3 workers: 215 worker-ms a page (budget 300)',
      over: false,
    })
  })

  it('refuses a build whose pages render slower, however few', () => {
    const slow = staticGeneration('✓ Generating static pages using 3 workers (2596/2596) in 4.5min')!
    expect(staticGenerationReport(slow).over).toBe(true)
    expect(staticGenerationReport({ pages: 100, workers: 3, seconds: 12 }).over).toBe(true)
    expect(PAGE_BUDGET_WORKER_MS).toBe(300)
  })
})
