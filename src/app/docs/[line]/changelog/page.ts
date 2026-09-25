import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { lines } from '@/lib/docs/site'
import { lineChangelog, renderChangelog } from '@/lib/docs/reference-pages'
import { docsHref } from '@/lib/urls'

type Params = { params: Promise<{ line: string }> }

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// page, which must answer a real 404 rather than stream a shell, and, under `next dev`, a page reached
// through the `latest` rewrite, whose URL is not among the static params. See the `instant` docs.
export const instant = false

export function generateStaticParams() {
  return lines()
    .filter(line => lineChangelog(line).length > 0)
    .map(line => ({ line }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line } = await params
  if (lineChangelog(line).length === 0) return {}
  return {
    title: `Changelog · ${line}`,
    description: `Every MeoCord ${line} release and what changed in it.`,
    alternates: { canonical: docsHref({ kind: 'changelog', line }, VERSIONS) },
  }
}

// Cached for the life of the build: the page depends only on the repository's files, and highlighting
// reads the clock, which a prerender allows only inside a cache.
async function changelogPage(line: string) {
  'use cache'
  cacheLife('max')
  return renderChangelog(line)?.render()
}

export default async function ChangelogPage({ params }: Params) {
  const { line } = await params
  return (await changelogPage(line)) ?? notFound()
}
