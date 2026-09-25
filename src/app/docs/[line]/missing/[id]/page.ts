import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import { missingArticle, missingParams, renderMissing } from '@/lib/docs/reference-pages'

type Params = { params: Promise<{ line: string; id: string }> }

/** A page the version switcher sends a reader to when the line they chose has no such page. */
export function generateStaticParams() {
  return missingParams()
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, id } = await params
  const article = missingArticle(line, id)
  return article ? { title: `${article.title} is not in ${line}`, robots: { index: false, follow: true } } : {}
}

// Cached for the life of the build: the page depends only on the repository's files, and highlighting
// reads the clock, which a prerender allows only inside a cache.
async function missingPage(line: string, id: string) {
  'use cache'
  cacheLife('max')
  return renderMissing(line, id)?.render()
}

export default async function MissingPage({ params }: Params) {
  const { line, id } = await params
  return (await missingPage(line, id)) ?? notFound()
}
