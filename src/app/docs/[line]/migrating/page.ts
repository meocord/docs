import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { lines } from '@/lib/docs/site'
import { migratingArticle, renderMigrating } from '@/lib/docs/reference-pages'
import { docsHref } from '@/lib/urls'

type Params = { params: Promise<{ line: string }> }

export function generateStaticParams() {
  return lines()
    .filter(line => migratingArticle(line))
    .map(line => ({ line }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line } = await params
  if (!migratingArticle(line)) return {}
  return {
    title: `Migrating · ${line}`,
    description: `Upgrading a bot to MeoCord ${line}.`,
    alternates: { canonical: docsHref({ kind: 'migrating', line }, VERSIONS) },
  }
}

export default async function MigratingPage({ params }: Params) {
  const { line } = await params
  return renderMigrating(line)?.render() ?? notFound()
}
