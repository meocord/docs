import type { Metadata } from 'next'
import { SITE_INDEXABLE } from '@/config/site'
import { ogImage } from '@/lib/og/cards'

/** How long a description may run, in characters, before it is cut at a word. */
export const DESCRIPTION_LENGTH = 155

/** Markdown reduced to the text it reads as: links to their words, code and emphasis to plain text. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_]([^*_\s][^*_]*?)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The first paragraph of a Markdown body: prose, not a heading, list, table, fence, quote or directive. */
export function firstParagraph(markdown: string): string {
  const blocks = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').split(/\n\s*\n/)
  return blocks.map(block => block.trim()).find(block => /^[\p{L}\p{N}`[*_"'“‘(]/u.test(block)) ?? ''
}

/** A description at most DESCRIPTION_LENGTH characters long, cut at a word and closed with an ellipsis. */
export function describe(markdown: string): string {
  const text = plainText(markdown)
  if (text.length <= DESCRIPTION_LENGTH) return text
  const cut = text.slice(0, DESCRIPTION_LENGTH - 1)
  const word = cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.–—-]+$/, '')
  return `${word}…`
}

/** Robots for a page: indexable only when the site is and the page should be. */
export function robots(index: boolean): Metadata['robots'] {
  return SITE_INDEXABLE ? { index, follow: true } : { index: false, follow: false }
}

export interface PageMetadataInput {
  /** What the page is about, such as "Guards"; the brand and line follow it. The home page has none. */
  title?: string
  /** The docs line the page belongs to, named in the title. */
  line?: string
  description: string
  /** The page's canonical path, also its og:url; none for a page that is not indexed. */
  canonical?: string
  /** Whether search engines may index it, when the site may be indexed at all. */
  index?: boolean
}

/**
 * A page's metadata, the same shape for every page type: "<title> · MeoCord <line>", a description
 * cut to fit a result, the canonical URL, the share card and robots.
 */
export function pageMetadata({ title, line, description, canonical, index = true }: PageMetadataInput): Metadata {
  const brand = `MeoCord${line ? ` ${line}` : ''}`
  const fullTitle = title ? `${title} · ${brand}` : brand
  const text = describe(description)
  return {
    title: { absolute: fullTitle },
    description: text,
    ...(canonical ? { alternates: { canonical } } : {}),
    robots: robots(index),
    openGraph: {
      siteName: 'MeoCord',
      type: title ? 'article' : 'website',
      locale: 'en_US',
      title: fullTitle,
      description: text,
      ...(canonical ? { url: canonical } : {}),
      images: [ogImage('site', 'home')],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description: text },
  }
}
