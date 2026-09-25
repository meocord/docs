/** A Pagefind result, as far as ranking needs it: its score, and its data's title and kind. */
export interface RankedResult {
  score: number
  title: string
  kind: string
}

/**
 * How much an API result's score counts unless its name is the query. Pagefind scores a prefix
 * match on a short page very highly, and API pages are short with camelCase names it also splits
 * into parts, so for "cooldown" seven Cooldown* symbols would outrank the Cooldowns guide.
 */
export const API_WEIGHT = 0.15

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Orders search results for a query: guides and changelogs by Pagefind's score, API symbols at a
 * fraction of theirs unless the query names them exactly, so "cooldown" finds the guide near the
 * top and "createMockInteraction" finds its API page first. Stable for equal scores.
 *
 * @param query - The text searched for.
 * @param results - Pagefind's results with their title and `kind` filter read.
 * @returns The same results, best first.
 *
 * @example
 * const results = await Promise.all(search.results.map(async result => {
 *   const data = await result.data()
 *   return { ...data, score: result.score, title: data.meta.title, kind: data.filters.kind[0] }
 * }))
 * rankResults('cooldown', results)
 */
export function rankResults<T extends RankedResult>(query: string, results: readonly T[]): T[] {
  const wanted = normalise(query)
  const weighted = (result: T) =>
    result.kind === 'api' && normalise(result.title) !== wanted ? result.score * API_WEIGHT : result.score
  return results
    .map((result, index) => ({ result, index, score: weighted(result) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.result)
}
