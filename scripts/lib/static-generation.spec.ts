import { describe, expect, it } from 'vitest'
import { STATIC_GENERATION_BUDGET_S, staticGeneration } from './static-generation.js'

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

  it('finds nothing without a finished summary', () => {
    expect(staticGeneration('Generating static pages using 3 workers (500/1097)')).toBeUndefined()
    expect(staticGeneration('')).toBeUndefined()
  })

  it('holds the budget the site agreed on', () => {
    expect(STATIC_GENERATION_BUDGET_S).toBe(180)
  })
})
