/**
 * The CPU slowdown that makes a host stand for Lighthouse's target phone, from the `benchmarkIndex`
 * Lighthouse measures on it. Lighthouse's docs/throttling.md leaves the number to its CPU throttling
 * calculator; this is the calculator's curve: 150 is 1x, 800 is 2x, 1300 is 3x, 1533 is Lighthouse's
 * default 4x, and each 233 above 1300 adds one more.
 */
export function cpuSlowdownFor(benchmarkIndex: number): number {
  if (!Number.isFinite(benchmarkIndex) || benchmarkIndex < 150) {
    throw new Error(`A host with benchmarkIndex ${benchmarkIndex} is too slow to stand for Lighthouse's target phone.`)
  }
  if (benchmarkIndex >= 1300) return 3 + (benchmarkIndex - 1300) / 233
  if (benchmarkIndex >= 800) return 2 + (benchmarkIndex - 800) / 500
  return 1 + (benchmarkIndex - 150) / 650
}
