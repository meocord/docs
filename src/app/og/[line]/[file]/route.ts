import { cardHash, findCard, parseCardFile } from '@/lib/og/cards'
import { renderCard } from '@/lib/og/render'
import { NOINDEX, SITE_INDEXABLE } from '@/config/site'

/** A card at `/og/<line>/<id>.<hash>.png`. Anything but the current hash is a 404, never a stale image. */
export async function GET(_request: Request, { params }: { params: Promise<{ line: string; file: string }> }) {
  const { line, file } = await params
  const parsed = parseCardFile(file)
  const card = parsed && findCard(line, parsed.id)
  if (!parsed || !card || parsed.hash !== cardHash(card)) {
    return new Response('Not found', { status: 404, headers: baseHeaders('public, max-age=300') })
  }

  const { png, engine } = await renderCard(card)
  return new Response(new Uint8Array(Buffer.from(png, 'base64')), {
    headers: {
      ...baseHeaders('public, max-age=31536000, immutable'),
      'Content-Type': 'image/png',
      // Which engine drew it, so a deploy can confirm the GPU path.
      'X-Rasteriser': engine,
    },
  })
}

function baseHeaders(cacheControl: string): Record<string, string> {
  return {
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    ...(SITE_INDEXABLE ? {} : { 'X-Robots-Tag': NOINDEX }),
  }
}
