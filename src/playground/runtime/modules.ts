/**
 * The modules a reader's code may import, which every line's runtime bundles and hands to the Worker as
 * its module map. The Guide's check refuses a `::playground` whose file imports anything else, so the two
 * never drift.
 */
export const READER_MODULES = [
  'discord.js',
  'meocord/common',
  'meocord/decorator',
  'meocord/enum',
  'meocord/interface',
  'meocord/testing',
  'reflect-metadata',
] as const

/**
 * The modules `source` imports or requires that a reader's code may not, in order of first use. A type-only
 * import is erased when the code compiles, so it imports nothing.
 */
export function outsideModules(source: string): string[] {
  const allowed: readonly string[] = READER_MODULES
  const found = [
    ...source.matchAll(/^\s*import\s+(?!type\s)(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm),
    ...source.matchAll(/^\s*export\s+(?!type\s)[^'";]*?\s+from\s+['"]([^'"]+)['"]/gm),
    ...source.matchAll(/\b(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g),
  ]
    .sort((a, b) => a.index - b.index)
    .map(match => match[1])
  return [...new Set(found.filter(specifier => !allowed.includes(specifier)))]
}
