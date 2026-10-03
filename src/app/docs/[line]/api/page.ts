import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { apiArrangement, apiLandingHref } from '@/lib/docs/api-site'
import { renderApiIndex } from '@/lib/docs/api-render'
import { pageMetadata } from '@/lib/docs/page-metadata'
import { lineParams, lines } from '@/lib/docs/site'
import { docsHref } from '@/lib/urls'

type Params = { params: Promise<{ line: string }> }

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// line, which must answer a real 404 rather than stream a shell. See the `instant` docs.
export const instant = false

export function generateStaticParams() {
  return lines()
    .filter(line => apiLandingHref(line) !== undefined)
    .map(line => ({ line }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line } = await lineParams(params)
  if (!lines().includes(line) || apiArrangement(line) !== 'kind') return {}
  return pageMetadata({
    title: 'API',
    line,
    description: `Every public symbol of MeoCord ${line}, by kind, with the entry point to import it from.`,
    canonical: docsHref({ kind: 'api-index', line }, VERSIONS),
  })
}

// Cached for the life of the build, as a symbol's page is.
async function apiIndex(line: string) {
  'use cache'
  cacheLife('max')
  return renderApiIndex(line)?.render()
}

// A line's API arranged by kind opens on its index; one by entry point opens where the sidebar's API tab does
export default async function ApiPage({ params }: Params) {
  const { line } = await lineParams(params)
  if (!lines().includes(line)) notFound()
  if (apiArrangement(line) === 'kind') return (await apiIndex(line)) ?? notFound()
  const href = apiLandingHref(line)
  if (!href) notFound()
  redirect(href)
}
