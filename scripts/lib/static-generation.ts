/** How long Next may spend prerendering every page, in seconds, before the build is too slow. */
export const STATIC_GENERATION_BUDGET_S = 180

const UNIT_SECONDS: Record<string, number> = { ms: 0.001, s: 1, min: 60 }

export interface StaticGeneration {
  pages: number
  workers: number
  seconds: number
}

/**
 * Next's summary of its prerender, from a build log: the last "Generating static pages using N workers
 * (P/P) in T" line, with T in milliseconds, seconds or, past two minutes, minutes. Undefined when the log
 * has none.
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
