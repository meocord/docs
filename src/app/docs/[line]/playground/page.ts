import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { VERSIONS } from '@/config/versions'
import { pageMetadata } from '@/lib/docs/page-metadata'
import { hasPlaygroundPage, renderPlaygroundPage } from '@/lib/docs/playground-page'
import { lines } from '@/lib/docs/site'
import { docsHref } from '@/lib/urls'

type Params = { params: Promise<{ line: string }> }

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// page, which must answer a real 404 rather than stream a shell, and, under `next dev`, a page reached
// through the `latest` rewrite, whose URL is not among the static params. See the `instant` docs.
export const instant = false

// A line's playground, where its Guide is rendered and the build has its runtime: it runs the line's pin,
// so there is no page per exact version
export function generateStaticParams() {
  return lines()
    .filter(line => hasPlaygroundPage(line))
    .map(line => ({ line }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line } = await params
  if (!hasPlaygroundPage(line)) return {}
  return pageMetadata({
    title: 'Playground',
    line,
    description: `Write a MeoCord ${line} controller and run it in your browser, through MeoCord's own dispatch.`,
    canonical: docsHref({ kind: 'playground', line }, VERSIONS),
  })
}

// Cached for the life of the build: the page depends only on the repository's files and the build's
// playground manifest.
async function playgroundPage(line: string) {
  'use cache'
  cacheLife('max')
  return renderPlaygroundPage(line)?.render()
}

export default async function PlaygroundPage({ params }: Params) {
  const { line } = await params
  return (await playgroundPage(line)) ?? notFound()
}
