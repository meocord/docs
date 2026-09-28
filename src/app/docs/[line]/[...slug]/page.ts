import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound, permanentRedirect } from 'next/navigation'
import { guideMeta, movedPageHref, pageParams } from '@/lib/docs/site'
import { renderGuide } from '@/lib/docs/render'
import { pageMetadata } from '@/lib/docs/page-metadata'

// A guide page by its path below the line: one segment, or two for a recipe or coming-from page of the Guide.
type Params = { params: Promise<{ line: string; slug: string[] }> }

// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// page, which must answer a real 404 rather than stream a shell, and, under `next dev`, a page reached
// through the `latest` rewrite, whose URL is not among the static params. See the `instant` docs.
export const instant = false

export function generateStaticParams() {
  return pageParams()
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, slug } = await params
  const meta = guideMeta(line, slug.join('/'))
  return meta ? pageMetadata({ ...meta, line }) : {}
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
  const page = await guide(line, slug.join('/'))
  if (page) return page
  // An old page's slug, which its page's `formerly` names, sent to where the page is now
  const moved = movedPageHref(line, slug.join('/'))
  return moved ? permanentRedirect(moved) : notFound()
}
