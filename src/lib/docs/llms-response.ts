import { NOINDEX, SITE_INDEXABLE } from '@/config/site'

/**
 * A text file for language models: Markdown served as plain text, so a browser shows it, cached as the sitemap is.
 * It repeats the pages, so search engines leave it out of their index; anything may still fetch it.
 */
export function llmsResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': SITE_INDEXABLE ? 'noindex' : NOINDEX,
    },
  })
}
