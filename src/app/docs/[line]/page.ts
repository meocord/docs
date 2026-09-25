import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { listPages } from '../../../../scripts/lib/pages'
import { guideMeta, lines } from '@/lib/docs/site'
import { renderGuide } from '@/lib/docs/render'
import { pageMetadata } from '@/lib/docs/page-metadata'

type Params = { params: Promise<{ line: string }> }

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// page, which must answer a real 404 rather than stream a shell, and, under `next dev`, a page reached
// through the `latest` rewrite, whose URL is not among the static params. See the `instant` docs.
export const instant = false

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
  return meta ? pageMetadata({ ...meta, line }) : {}
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
