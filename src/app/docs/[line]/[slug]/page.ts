import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { guideMeta, pageParams } from '@/lib/docs/site'
import { renderGuide } from '@/lib/docs/render'

type Params = { params: Promise<{ line: string; slug: string }> }

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// page, which must answer a real 404 rather than stream a shell, and, under `next dev`, a page reached
// through the `latest` rewrite, whose URL is not among the static params. See the `instant` docs.
export const instant = false

export function generateStaticParams() {
  return pageParams()
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, slug } = await params
  const meta = guideMeta(line, slug)
  return meta ? { title: meta.title, alternates: { canonical: meta.canonical } } : {}
}

// Cached for the life of the build: the page depends only on the repository's files, and highlighting
// reads the clock, which a prerender allows only inside a cache.
async function guide(line: string, slug: string) {
  'use cache'
  cacheLife('max')
  return renderGuide(line, slug)?.render()
}

export default async function GuidePage({ params }: Params) {
  const { line, slug } = await params
  return (await guide(line, slug)) ?? notFound()
}
