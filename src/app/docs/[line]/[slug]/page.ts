import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { guidePage, pageParams } from '@/lib/docs/site'
import { renderGuide } from '@/lib/docs/render'

type Params = { params: Promise<{ line: string; slug: string }> }

export function generateStaticParams() {
  return pageParams()
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { line, slug } = await params
  const page = guidePage(line, slug)
  return page ? { title: page.entry.title, alternates: { canonical: page.canonical } } : {}
}

export default async function GuidePage({ params }: Params) {
  const { line, slug } = await params
  return renderGuide(line, slug)?.render() ?? notFound()
}
