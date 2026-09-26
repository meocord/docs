/**
 * The slowdown Lighthouse's CPU throttling calculator gives for a host's `benchmarkIndex`, the number
 * Lighthouse's docs/throttling.md leaves to it: 150 is 1x, 800 is 2x, 1300 is 3x, 1533 is Lighthouse's
 * default 4x, and each 233 above 1300 adds one more, without end.
 */
export function calculatorSlowdown(benchmarkIndex: number): number {
  if (!Number.isFinite(benchmarkIndex) || benchmarkIndex < 150) {
    throw new Error(`A host with benchmarkIndex ${benchmarkIndex} is too slow to stand for Lighthouse's target phone.`)
  }
  if (benchmarkIndex >= 1300) return 3 + (benchmarkIndex - 1300) / 233
  if (benchmarkIndex >= 800) return 2 + (benchmarkIndex - 800) / 500
  return 1 + (benchmarkIndex - 150) / 650
}

/**
 * The furthest the calculator's curve is followed: the top of the range docs/throttling.md gives for a
 * high-end desktop standing for a mid-tier phone. The calculator's anchors stop at 2000 (6x); past them
 * its line is an extrapolation, which on a host near 4000 slows the CPU nearly 15x.
 */
export const MAX_CPU_SLOWDOWN = 10

/** The CPU slowdown that makes a host stand for Lighthouse's target phone: the calculator's, at most 10x. */
export function cpuSlowdownFor(benchmarkIndex: number): number {
  return Math.min(calculatorSlowdown(benchmarkIndex), MAX_CPU_SLOWDOWN)
}
