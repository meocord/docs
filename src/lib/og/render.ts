import path from 'node:path'
import { cacheLife } from 'next/cache'
import { Box, Column, type FontRegistration, Root, Row, Text } from 'meo-canvas'
import { MARK_DARK, markNode } from '@/lib/brand/mark'
import type { OgCard } from '@/lib/og/cards'

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts')

const fonts: FontRegistration[] = [
  {
    family: 'Instrument Sans',
    paths: [path.join(FONT_DIR, 'InstrumentSans-Regular.ttf'), path.join(FONT_DIR, 'InstrumentSans-SemiBold.ttf')],
  },
  {
    family: 'JetBrains Mono',
    paths: [path.join(FONT_DIR, 'JetBrainsMono-Regular.ttf'), path.join(FONT_DIR, 'JetBrainsMono-SemiBold.ttf')],
  },
]

// The dark palette: Discord, where most links are shared, is dark by default.
const CANVAS = '#161618'
const SHEET = '#1E1E21'
const HAIRLINE = 'rgba(255,255,255,0.10)'
const INK = 'rgba(255,255,255,0.88)'
const SECONDARY = 'rgba(255,255,255,0.62)'
const QUIET = 'rgba(255,255,255,0.40)'
const ACCENT = '#8C98FF'

const INSET = 56

/** A drawn card, and which of meo-canvas's engines drew it (`gpu` or `cpu`). */
export interface RenderedCard {
  png: string
  engine: string
}

/** The "since" chip, outlined like the badges on the pages. */
function sinceChip(version: string) {
  return Row({
    alignItems: 'center',
    gap: 12,
    children: [
      Text('since', { fontSize: 18, color: QUIET }),
      Box({
        padding: { top: 4, bottom: 4, left: 10, right: 10 },
        border: 1.5,
        borderStyle: 'solid',
        borderColor: QUIET,
        borderRadius: 6,
        children: Text(version, { fontFamily: 'JetBrains Mono', fontSize: 18, color: SECONDARY }),
      }),
    ],
  })
}

/**
 * Draws a card as base64 PNG, cached for as long as the process lives: the URL carries the content
 * hash, so a card never changes under its URL. Uses the GPU when present, else meo-canvas's CPU path.
 *
 * The card is the site in miniature: the toolbar with the mark, then the opaque reading sheet, which
 * bleeds off the right and bottom edges. Discord shows it at about a third of its size, so the title is
 * set large enough to stay readable there.
 */
export async function renderCard(card: OgCard): Promise<RenderedCard> {
  'use cache'
  cacheLife('max')

  const canvas = await Root({
    width: 1200,
    height: 630,
    backgroundColor: CANVAS,
    gpu: true,
    fonts,
    fontFamily: 'Instrument Sans',
    flexDirection: 'column',
    children: [
      Row({
        height: 88,
        padding: { left: INSET, right: INSET },
        alignItems: 'center',
        gap: 16,
        children: [
          markNode(40, MARK_DARK),
          Text('MeoCord', { fontSize: 24, fontWeight: 600, color: INK }),
          Box({ flexGrow: 1 }),
          ...(card.version ? [sinceChip(card.version)] : []),
        ],
      }),
      Column({
        flexGrow: 1,
        margin: { left: INSET },
        backgroundColor: SHEET,
        border: { top: 1, left: 1 },
        borderStyle: 'solid',
        borderColor: HAIRLINE,
        borderRadius: { topLeft: 14 },
        padding: { top: 52, left: INSET, right: 120, bottom: 44 },
        gap: 20,
        children: [
          Text(card.eyebrow, { fontSize: 22, color: QUIET }),
          Text(card.title, {
            fontSize: card.summary ? 64 : 60,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: -1.4,
            color: INK,
            maxLines: 2,
          }),
          ...(card.summary
            ? [Text(card.summary, { fontSize: 26, lineHeight: 1.4, color: SECONDARY, maxLines: 2 })]
            : []),
          Box({ flexGrow: 1 }),
          Row({
            alignItems: 'center',
            gap: 24,
            children: [
              ...(card.code
                ? [Text(card.code, { fontFamily: 'JetBrains Mono', fontSize: 24, color: ACCENT, maxLines: 1 })]
                : []),
              Box({ flexGrow: 1 }),
              Text('meocord.meoverse.com', { fontFamily: 'JetBrains Mono', fontSize: 18, color: QUIET }),
            ],
          }),
        ],
      }),
    ],
  })
  try {
    const buffer = await canvas.toBuffer('png')
    return { png: buffer.toString('base64'), engine: canvas.engine }
  } finally {
    canvas.release()
  }
}
