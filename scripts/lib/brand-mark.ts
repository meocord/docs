/**
 * The mark's one source is tools/brand/mark.json in the meocord repository; the site keeps a verbatim
 * copy in src/lib/brand/mark.json. `brand:sync` fetches meocord main's and writes it, and `brand:check`
 * fails when the copy differs, so the site's mark cannot drift from the one meocord draws.
 */

import type { Fetch } from './registry.js'

export const CANONICAL_MARK_URL = 'https://raw.githubusercontent.com/meocord/meocord/main/tools/brand/mark.json'

/** The copy the site reads, relative to the repository root. */
export const MARK_COPY = 'src/lib/brand/mark.json'

/** A 404 for the canonical mark: a definite answer that it is not there, unlike a failure to reach it. */
export class MarkMissingError extends Error {}

/** meocord main's mark.json, as its bytes, rejecting on anything but a 200. */
export async function fetchCanonicalMark(fetchImpl: Fetch = fetch): Promise<string> {
  const response = await fetchImpl(CANONICAL_MARK_URL)
  if (response.status === 404) throw new MarkMissingError(`${CANONICAL_MARK_URL} does not exist`)
  if (!response.ok) throw new Error(`${CANONICAL_MARK_URL} answered ${response.status}`)
  return response.text()
}

export type MarkCheck =
  { status: 'same' } | { status: 'differs' } | { status: 'missing' } | { status: 'unreachable'; reason: string }

/** How many times a failed fetch is tried, and the wait before each retry, so a blip does not fail a run. */
export const FETCH_ATTEMPTS = 3
const retryDelayMs = (attempt: number) => 1000 * attempt

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Compares the site's copy with meocord main's, byte for byte. A fetch that fails is tried up to
 * FETCH_ATTEMPTS times; a 404 is an answer, and is not retried.
 */
export async function checkMark(
  copy: string | undefined,
  fetchImpl: Fetch = fetch,
  wait: (ms: number) => Promise<unknown> = sleep,
): Promise<MarkCheck> {
  const reasons: string[] = []
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const canonical = await fetchCanonicalMark(fetchImpl)
      return copy === canonical ? { status: 'same' } : { status: 'differs' }
    } catch (error) {
      if (error instanceof MarkMissingError) return { status: 'missing' }
      reasons.push(error instanceof Error ? error.message : String(error))
      if (attempt < FETCH_ATTEMPTS) await wait(retryDelayMs(attempt))
    }
  }
  return { status: 'unreachable', reason: `${FETCH_ATTEMPTS} attempts: ${reasons.join('; ')}` }
}

/**
 * What a check means for CI: a copy that differs, or a canonical mark that is gone, always fails;
 * meocord unreachable fails on main and in the merge queue, where a drift would ship, and only warns on
 * a pull request, where a network blip should not block review.
 */
export function markVerdict(
  check: MarkCheck,
  { onMain }: { onMain: boolean },
): { level: 'pass' | 'warn' | 'fail'; message: string } {
  if (check.status === 'same') return { level: 'pass', message: `${MARK_COPY} matches meocord main.` }
  if (check.status === 'differs') {
    return {
      level: 'fail',
      message: `${MARK_COPY} differs from meocord main's tools/brand/mark.json. Run \`bun run brand:sync\` and commit the result.`,
    }
  }
  if (check.status === 'missing') {
    return {
      level: 'fail',
      message: `meocord main has no tools/brand/mark.json (${CANONICAL_MARK_URL}) to check ${MARK_COPY} against.`,
    }
  }
  const message = `Could not fetch meocord main's mark to compare with ${MARK_COPY}: ${check.reason}.`
  return { level: onMain ? 'fail' : 'warn', message }
}
