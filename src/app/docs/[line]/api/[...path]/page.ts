import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { apiModel, apiParams, exactApiParams } from '@/lib/docs/api-site'
import { renderApiPage } from '@/lib/docs/api-render'
import { docsHref } from '@/lib/urls'

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
  const title = `${symbol.name} · ${symbol.entry}`
  const lineHasIt = !!apiModel(line)?.symbol(target.entry, target.symbol)
  const canonical = lineHasIt
    ? docsHref({ kind: 'api', line, entry: target.entry, symbol: target.symbol }, VERSIONS)
    : undefined
  return {
    title,
    description: symbol.description.split('\n')[0] || undefined,
    alternates: canonical ? { canonical } : undefined,
    ...(target.version ? { robots: { index: false, follow: true } } : {}),
  }
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
