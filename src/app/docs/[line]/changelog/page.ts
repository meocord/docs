import type { Metadata } from 'next'
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

export default async function ChangelogPage({ params }: Params) {
  const { line } = await params
  return renderChangelog(line)?.render() ?? notFound()
}
