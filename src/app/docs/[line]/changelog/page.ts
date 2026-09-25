import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { lines } from '@/lib/docs/site'
import { lineChangelog, renderChangelog } from '@/lib/docs/reference-pages'
import { docsHref } from '@/lib/urls'

type Params = { params: Promise<{ line: string }> }

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
