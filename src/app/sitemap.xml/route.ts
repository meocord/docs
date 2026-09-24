import { NOINDEX, SITE_INDEXABLE, SITE_URL } from '@/config/site'

/** The pages to index: none until the site is indexable. */
const PATHS = ['/']

export function GET() {
  const urls = SITE_INDEXABLE ? PATHS.map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n') : ''
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}${urls ? '\n' : ''}</urlset>\n`
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      ...(SITE_INDEXABLE ? {} : { 'X-Robots-Tag': NOINDEX }),
    },
  })
}
