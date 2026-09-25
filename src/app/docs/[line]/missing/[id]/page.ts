import type { Metadata } from 'next'
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

export default async function MissingPage({ params }: Params) {
  const { line, id } = await params
  return renderMissing(line, id)?.render() ?? notFound()
}
