import { lineIndexed, VERSIONS } from '@/config/versions'
import { apiArrangement, apiModel, apiParams, apiSections, cliParams, glanceParams } from '@/lib/docs/api-site'
import { CLI_SECTION } from '@/lib/docs/cli-site'
import { GLANCE_SECTION } from '@/lib/docs/glance'
import { hasPlaygroundPage } from '@/lib/docs/guide-site'
import { changelogParams, hasMigrating, lineChangelog } from '@/lib/docs/reference-pages'
import { linePages, lines } from '@/lib/docs/site'
import { docsHref, type DocsTarget } from '@/lib/urls'

/**
 * The canonical path of every page search engines may index: the home page, and each page of an indexed
 * line, from the same sources its route prerenders from. An exact version's page, a missing page and a
 * line's root, whose canonical is its first page, are left out.
 */
export function indexedPaths(): string[] {
  return [
    '/',
    ...lines()
      .filter(line => lineIndexed(line))
      .flatMap(linePaths),
  ]
}

function linePaths(line: string): string[] {
  const href = (target: DocsTarget) => docsHref(target, VERSIONS)
  const of = <P extends { line: string }>(params: P[]) => params.filter(param => param.line === line)
  // The index and each section's page exist where the API is arranged by kind: its kinds, the cheat sheets and the CLI
  const model = apiArrangement(line) === 'kind' ? apiModel(line) : undefined
  const kinds = model ? apiSections(model) : []
  return [
    ...linePages(line).map(page => page.href),
    ...(kinds.length > 0 ? [href({ kind: 'api-index', line })] : []),
    ...kinds.map(section => href({ kind: 'api-index', line, section: section.slug })),
    ...of(apiParams()).map(({ section, symbol }) => href({ kind: 'api', line, section, symbol })),
    ...of(glanceParams()).map(({ topic }) => href({ kind: 'api', line, section: GLANCE_SECTION, symbol: topic })),
    ...of(cliParams())
      .filter(param => !param.version)
      .map(({ command }) => href({ kind: 'api', line, section: CLI_SECTION, symbol: command })),
    ...(lineChangelog(line).length > 0 ? [href({ kind: 'changelog', line })] : []),
    ...of(changelogParams()).map(({ version }) => href({ kind: 'changelog', line, version })),
    ...(hasMigrating(line) ? [href({ kind: 'migrating', line })] : []),
    ...(hasPlaygroundPage(line) ? [href({ kind: 'playground', line })] : []),
  ]
}
