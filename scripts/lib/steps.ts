/**
 * Tutorial steps in shared example files. The Guide builds one bot across its chapters, so a file such
 * as examples/4.1/src/tutorial/app.ts is shown on several pages, each as it stands at that page:
 *
 * - `// #region step:<page>` … `// #endregion step:<page>` wraps lines a page's step adds: they appear
 *   from that page on in reading order, and are left out before it.
 * - `// before:<page> <code>` is a line the page's step replaces: shown, uncommented, before that page,
 *   and left out from it on. Only a replacement step the Guide allows uses it.
 *
 * Reading order is the Guide's plan, so a file's steps are fixed however many pages are written yet.
 */

import { GUIDE_PLAN } from './guide'

/** Every planned Guide path in reading order. */
export const READING_ORDER: readonly string[] = Object.values(GUIDE_PLAN).flat()

const STEP_START = /^\s*\/\/ #region step:(\S+)\s*$/
const STEP_END = /^\s*\/\/ #endregion step:(\S+)\s*$/
const BEFORE = /^(\s*)\/\/ before:(\S+) (.*)$/

/** Where a page falls in reading order, or undefined for a path that is not on the plan. */
export function stepIndex(page: string): number | undefined {
  const index = READING_ORDER.indexOf(page)
  return index === -1 ? undefined : index
}

/** The pages a file's steps name, once each, in reading order; those off the plan last. */
export function stepsIn(source: string): string[] {
  const named = new Set<string>()
  for (const line of source.split('\n')) {
    const page = STEP_START.exec(line)?.[1] ?? BEFORE.exec(line)?.[2]
    if (page) named.add(page)
  }
  return [...named].sort((a, b) => (stepIndex(a) ?? Infinity) - (stepIndex(b) ?? Infinity))
}

/** What is wrong with a file's step marks: a page off the plan, or a region left open or closed twice. */
export function stepProblems(source: string): string[] {
  const problems: string[] = []
  let open: string | undefined
  source.split('\n').forEach((line, index) => {
    const at = `line ${index + 1}`
    const start = STEP_START.exec(line)?.[1]
    const end = STEP_END.exec(line)?.[1]
    const before = BEFORE.exec(line)?.[2]
    for (const page of [start, before]) {
      if (page && stepIndex(page) === undefined)
        problems.push(`${at}: step "${page}" is not a page of the Guide's plan`)
    }
    if (start) {
      if (open) problems.push(`${at}: step:${start} opens inside step:${open}`)
      open = start
    }
    if (end) {
      if (end !== open) problems.push(`${at}: #endregion step:${end} closes no open step region`)
      open = undefined
    }
  })
  if (open) problems.push(`step:${open} is never closed`)
  return problems
}

/**
 * A file as it stands at a page: the steps of that page and those before it in, the later ones out,
 * and each `before:` line shown only before its page. Without a page, the finished file: every step
 * in, and no `before:` line.
 */
export function asOf(source: string, page?: string): string {
  const at = page === undefined ? Infinity : (stepIndex(page) ?? Infinity)
  const reached = (step: string) => (stepIndex(step) ?? Infinity) <= at
  const out: string[] = []
  let skipping: string | undefined
  for (const line of source.split('\n')) {
    if (skipping) {
      if (STEP_END.exec(line)?.[1] === skipping) skipping = undefined
      continue
    }
    const start = STEP_START.exec(line)?.[1]
    if (start && !reached(start)) {
      skipping = start
      continue
    }
    const before = BEFORE.exec(line)
    if (before) {
      if (!reached(before[2])) out.push(`${before[1]}${before[3]}`)
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}
