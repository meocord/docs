import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { listPages } from '../../../../scripts/lib/pages'
import { guideMeta, lines } from '@/lib/docs/site'
import { renderGuide } from '@/lib/docs/render'

type Params = { params: Promise<{ line: string }> }

export function generateStaticParams() {
  return lines().map(line => ({ line }))
}

// A line lands on its first page, which stays canonical at its own URL.
function landing(line: string) {
  return listPages(line)[0]?.slug
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line } = await params
  const slug = landing(line)
  const meta = slug && guideMeta(line, slug)
  return meta ? { title: meta.title, alternates: { canonical: meta.canonical } } : {}
}

async function lineLanding(line: string) {
  'use cache'
  cacheLife('max')
  const slug = landing(line)
  return slug ? renderGuide(line, slug)?.render() : undefined
}

export default async function LinePage({ params }: Params) {
  const { line } = await params
  return (await lineLanding(line)) ?? notFound()
}
