import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { guideMeta, pageParams } from '@/lib/docs/site'
import { renderGuide } from '@/lib/docs/render'

type Params = { params: Promise<{ line: string; slug: string }> }

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
