import { NOINDEX, SITE_INDEXABLE, SITE_URL } from '@/config/site'

/** Disallows everything until the site is indexable; a route handler, so it can carry the header. */
export function GET() {
  const body = SITE_INDEXABLE
    ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n'
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      ...(SITE_INDEXABLE ? {} : { 'X-Robots-Tag': NOINDEX }),
    },
  })
}
