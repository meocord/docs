import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound, permanentRedirect } from 'next/navigation'
import { missingArticle, missingParams, movedMissingHref, renderMissing } from '@/lib/docs/reference-pages'
import { pageMetadata } from '@/lib/docs/page-metadata'
import { lineParams } from '@/lib/docs/site'

type Params = { params: Promise<{ line: string; id: string }> }

/** A page the version switcher sends a reader to when the line they chose has no such page. */
// Every page that exists is prerendered from generateStaticParams. What remains may block: an unknown
// page, which must answer a real 404 rather than stream a shell, and, under `next dev`, a page reached
// through the `latest` rewrite, whose URL is not among the static params. See the `instant` docs.
export const instant = false

export function generateStaticParams() {
  return missingParams()
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, id } = await lineParams(params)
  const article = missingArticle(line, id)
  return article
    ? pageMetadata({
        title: `${article.title} (not documented)`,
        line,
        description: `${article.title} is not documented for MeoCord ${line}. See where it is, and what ${line} documents.`,
        index: false,
      })
    : {}
}

// Cached for the life of the build: the page depends only on the repository's files, and highlighting
// reads the clock, which a prerender allows only inside a cache.
async function missingPage(line: string, id: string) {
  'use cache'
  cacheLife('max')
  return renderMissing(line, id)?.render()
}

export default async function MissingPage({ params }: Params) {
  const { line, id } = await lineParams(params)
  // A line that has a page on the topic, or an old id of a topic it lacks, sends the reader where it is now
  const moved = movedMissingHref(line, id)
  if (moved) permanentRedirect(moved)
  return (await missingPage(line, id)) ?? notFound()
}
