import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { apiArrangement, apiKindParams, apiModel, apiParams, exactApiParams } from '@/lib/docs/api-site'
import { renderApiKind, renderApiPage } from '@/lib/docs/api-render'
import { docsHref } from '@/lib/urls'
import { firstParagraph, pageMetadata } from '@/lib/docs/page-metadata'

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
  ]
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, path } = await params
  const target = parse(line, path)
  if (!target) return {}
  if (!target.symbol) {
    const kind = apiModel(line)
      ?.sections()
      .find(section => section.slug === target.section)
    if (!kind) return {}
    return pageMetadata({
      title: `${kind.title} · API`,
      line,
      description: `MeoCord ${line}'s ${kind.title.toLowerCase()}: ${kind.symbols.map(symbol => symbol.name).join(', ')}.`,
      canonical: docsHref({ kind: 'api-index', line, section: target.section }, VERSIONS),
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
  return target.symbol
    ? renderApiPage(line, target.section, target.symbol, target.version)?.render()
    : renderApiKind(line, target.section)?.render()
}

export default async function ApiPage({ params }: Params) {
  const { line, path } = await params
  return (await apiPage(line, path)) ?? notFound()
}
