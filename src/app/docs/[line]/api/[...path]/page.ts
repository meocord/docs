import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { moveTo } from '@/lib/docs/moves'
import { VERSIONS } from '@/config/versions'
import {
  apiArrangement,
  apiKindParams,
  apiModel,
  apiParams,
  apiSections,
  cliParams,
  exactApiParams,
  glanceParams,
  lineVersions,
  movedApiHref,
  olderApiHref,
} from '@/lib/docs/api-site'
import { renderApiKind, renderApiPage, renderCliPage, renderGlancePage } from '@/lib/docs/api-render'
import { CLI_SECTION, cliCommand, cliManifest, commandSummary } from '@/lib/docs/cli-site'
import { GLANCE_SECTION, glanceTopic } from '@/lib/docs/glance'
import { docsHref, versionElsewhere } from '@/lib/urls'
import { firstParagraph, pageMetadata } from '@/lib/docs/page-metadata'
import { lineParams } from '@/lib/docs/site'

type Params = { params: Promise<{ line: string; path: string[] }> }

/**
 * `<section>/<symbol>` is the line's API, from its newest version; `<version>/<section>/<symbol>` is an
 * exact version's, prerendered too and kept out of search indexes. A section is an entry point, or a
 * kind where the line's API is arranged by kind, and then `<section>` alone is that kind's page.
 */
function parse(line: string, path: string[]): { section: string; symbol?: string; version?: string } | undefined {
  if (path.length === 1 && apiArrangement(line) === 'kind') return { section: path[0] }
  if (path.length === 2) return { section: path[0], symbol: path[1] }
  if (path.length === 3) return { version: path[0], section: path[1], symbol: path[2] }
  return undefined
}

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// page, which must answer a real 404 rather than stream a shell, and, under `next dev`, a page reached
// through the `latest` rewrite, whose URL is not among the static params. See the `instant` docs.
export const instant = false

export function generateStaticParams() {
  return [
    ...apiKindParams().map(({ line, section }) => ({ line, path: [section] })),
    ...apiParams().map(({ line, section, symbol }) => ({ line, path: [section, symbol] })),
    ...exactApiParams().map(({ line, version, section, symbol }) => ({ line, path: [version, section, symbol] })),
    ...glanceParams().map(({ line, topic }) => ({ line, path: [GLANCE_SECTION, topic] })),
    ...cliParams().map(({ line, version, command }) => ({
      line,
      path: version ? [version, CLI_SECTION, command] : [CLI_SECTION, command],
    })),
  ]
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, path } = await lineParams(params)
  const target = parse(line, path)
  if (!target) return {}
  if (!target.symbol) {
    const model = apiModel(line)
    const kind = model && apiSections(model).find(section => section.slug === target.section)
    if (!kind) return {}
    const names = kind.symbols.map(symbol => symbol.name).join(', ')
    return pageMetadata({
      title: `${kind.title} · API`,
      line,
      description:
        kind.slug === GLANCE_SECTION
          ? `MeoCord ${line} at a glance, a cheat sheet per task: ${names}.`
          : kind.slug === CLI_SECTION
            ? `The meocord command line of MeoCord ${line}: ${names}.`
            : `MeoCord ${line}'s ${kind.title.toLowerCase()}: ${names}.`,
      canonical: docsHref({ kind: 'api-index', line, section: target.section }, VERSIONS),
    })
  }
  // A cheat sheet, where the line's API is arranged by kind
  if (target.section === GLANCE_SECTION && !target.version && apiArrangement(line) === 'kind') {
    const topic = glanceTopic(target.symbol)
    if (!topic) return {}
    return pageMetadata({
      title: `${topic.title} at a glance · API`,
      line,
      description: topic.summary.replace(/`/g, ''),
      canonical: docsHref({ kind: 'api', line, section: GLANCE_SECTION, symbol: topic.slug }, VERSIONS),
    })
  }
  // A CLI command's page, where the line's API is arranged by kind
  if (target.section === CLI_SECTION && apiArrangement(line) === 'kind') {
    const manifest = cliManifest(target.version ?? lineVersions(line)[0])
    const command = manifest && cliCommand(manifest, target.symbol)
    if (!command) return {}
    return pageMetadata({
      title: `meocord ${command.name} · CLI${target.version ? ` ${target.version}` : ''}`,
      line,
      description: commandSummary(command) || `The meocord ${command.name} command.`,
      canonical: docsHref({ kind: 'api', line, section: CLI_SECTION, symbol: command.name }, VERSIONS),
      index: !target.version,
    })
  }
  const symbol = apiModel(line, target.version)?.symbol(target.section, target.symbol)
  if (!symbol) return {}
  const lineHasIt = !!apiModel(line)?.symbol(target.section, target.symbol)
  const canonical = lineHasIt
    ? docsHref({ kind: 'api', line, section: target.section, symbol: target.symbol }, VERSIONS)
    : undefined
  return pageMetadata({
    title: target.version ? `${symbol.name} · ${symbol.entry} ${target.version}` : `${symbol.name} · ${symbol.entry}`,
    line,
    // The doc comment's summary, or what the symbol is when it has none.
    description: firstParagraph(symbol.description) || `${symbol.kind} ${symbol.name} in ${symbol.entry}.`,
    canonical,
    // An exact version's page points at the line's; only the line's is indexed.
    index: !target.version,
  })
}

// Cached for the life of the build: the page depends only on the repository's files, and highlighting
// reads the clock, which a prerender allows only inside a cache.
async function apiPage(line: string, path: string[]) {
  'use cache'
  cacheLife('max')
  const target = parse(line, path)
  if (!target) return undefined
  if (!target.symbol) return renderApiKind(line, target.section)?.render()
  if (target.section === GLANCE_SECTION && !target.version) return renderGlancePage(line, target.symbol)?.render()
  return target.section === CLI_SECTION && apiArrangement(line) === 'kind'
    ? renderCliPage(line, target.symbol, target.version)?.render()
    : renderApiPage(line, target.section, target.symbol, target.version)?.render()
}

export default async function ApiPage({ params }: Params) {
  const { line, path } = await lineParams(params)
  const page = await apiPage(line, path)
  if (page) return page
  // A page by entry point, from before the line's API was arranged by kind, sent to where it is now
  const target = parse(line, path)
  const moved = target?.symbol && movedApiHref(line, target.version, target.section, target.symbol)
  if (moved) moveTo(moved, 'line-page', line)
  // Another line's exact version, or a symbol only an older line has, as an old `latest` URL reaches this line once it
  // is current: sent to that line's page
  const owner = target?.version && versionElsewhere(line, target.version, VERSIONS)
  if (owner) moveTo(`/docs/${owner}/api/${path.join('/')}`, 'exact-version', line)
  const older = target?.symbol && !target.version && olderApiHref(line, target.section, target.symbol)
  return older ? redirect(older) : notFound()
}
