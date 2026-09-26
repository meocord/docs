import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { changelogParams, changelogSummary, renderRelease, versionChangelog } from '@/lib/docs/reference-pages'
import { docsHref } from '@/lib/urls'
import { pageMetadata } from '@/lib/docs/page-metadata'

type Params = { params: Promise<{ line: string; version: string }> }

// Every release that exists is prerendered from generateStaticParams; anything else answers a real 404.
export const instant = false

export function generateStaticParams() {
  return changelogParams()
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, version } = await params
  const changelog = versionChangelog(line, version)
  if (!changelog) return {}
  return pageMetadata({
    title: `${version} changelog`,
    line,
    description: `What changed in MeoCord ${version}: ${changelogSummary(changelog).replace(/\.?$/, '.')}`,
    canonical: docsHref({ kind: 'changelog', line, version }, VERSIONS),
  })
}

// Cached for the life of the build, as the line's changelog page is.
async function releasePage(line: string, version: string) {
  'use cache'
  cacheLife('max')
  return renderRelease(line, version)?.render()
}

export default async function ReleasePage({ params }: Params) {
  const { line, version } = await params
  return (await releasePage(line, version)) ?? notFound()
}
