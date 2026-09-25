import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { lines } from '@/lib/docs/site'
import { hasMigrating, renderMigrating } from '@/lib/docs/reference-pages'
import { docsHref } from '@/lib/urls'

type Params = { params: Promise<{ line: string }> }

export function generateStaticParams() {
  return lines()
    .filter(line => hasMigrating(line))
    .map(line => ({ line }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line } = await params
  if (!hasMigrating(line)) return {}
  return {
    title: `Migrating · ${line}`,
    description: `Upgrading a bot to MeoCord ${line}.`,
    alternates: { canonical: docsHref({ kind: 'migrating', line }, VERSIONS) },
  }
}

// Cached for the life of the build: the page depends only on the repository's files, and highlighting
// reads the clock, which a prerender allows only inside a cache.
async function migratingPage(line: string) {
  'use cache'
  cacheLife('max')
  return renderMigrating(line)?.render()
}

export default async function MigratingPage({ params }: Params) {
  const { line } = await params
  return (await migratingPage(line)) ?? notFound()
}
