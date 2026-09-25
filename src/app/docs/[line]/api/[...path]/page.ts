import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { apiModel, apiParams, exactApiParams } from '@/lib/docs/api-site'
import { renderApiPage } from '@/lib/docs/api-render'
import { docsHref } from '@/lib/urls'
import { firstParagraph, pageMetadata } from '@/lib/docs/page-metadata'

type Params = { params: Promise<{ line: string; path: string[] }> }

/**
 * `<entry>/<symbol>` is the line's API, from its newest version; `<version>/<entry>/<symbol>` is an
 * exact version's, prerendered too and kept out of search indexes.
 */
function parse(path: string[]): { entry: string; symbol: string; version?: string } | undefined {
  if (path.length === 2) return { entry: path[0], symbol: path[1] }
  if (path.length === 3) return { version: path[0], entry: path[1], symbol: path[2] }
  return undefined
}

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// page, which must answer a real 404 rather than stream a shell, and, under `next dev`, a page reached
// through the `latest` rewrite, whose URL is not among the static params. See the `instant` docs.
export const instant = false

export function generateStaticParams() {
  return [
    ...apiParams().map(({ line, entry, symbol }) => ({ line, path: [entry, symbol] })),
    ...exactApiParams().map(({ line, version, entry, symbol }) => ({ line, path: [version, entry, symbol] })),
  ]
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, path } = await params
  const target = parse(path)
  const symbol = target && apiModel(line, target.version)?.symbol(target.entry, target.symbol)
  if (!target || !symbol) return {}
  const lineHasIt = !!apiModel(line)?.symbol(target.entry, target.symbol)
  const canonical = lineHasIt
    ? docsHref({ kind: 'api', line, entry: target.entry, symbol: target.symbol }, VERSIONS)
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
  const target = parse(path)
  return target ? renderApiPage(line, target.entry, target.symbol, target.version)?.render() : undefined
}

export default async function ApiPage({ params }: Params) {
  const { line, path } = await params
  return (await apiPage(line, path)) ?? notFound()
}
