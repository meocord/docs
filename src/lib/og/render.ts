import path from 'node:path'
import { cacheLife } from 'next/cache'
import { Column, type FontRegistration, Root, Text } from 'meo-canvas'
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

const INK = '#E7E8EE'
const DIM = '#8A8C98'
const ACCENT = '#8F9BFF'

/** A drawn card, and which of meo-canvas's engines drew it (`gpu` or `cpu`). */
export interface RenderedCard {
  png: string
  engine: string
}

/**
 * Draws a card as base64 PNG, cached for as long as the process lives: the URL carries the content
 * hash, so a card never changes under its URL. Uses the GPU when present, else meo-canvas's CPU path.
 */
export async function renderCard(card: OgCard): Promise<RenderedCard> {
  'use cache'
  cacheLife('max')

  const canvas = await Root({
    width: 1200,
    height: 630,
    backgroundColor: '#0D0E12',
    gpu: true,
    fonts,
    fontFamily: 'Instrument Sans',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 80,
    children: [
      Text(card.eyebrow.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 22, color: ACCENT, letterSpacing: 3 }),
      Column({
        gap: 16,
        children: [
          Text(card.title, { fontSize: 72, fontWeight: 600, lineHeight: 1.08, color: INK, letterSpacing: -2 }),
          ...(card.version ? [Text(card.version, { fontFamily: 'JetBrains Mono', fontSize: 24, color: DIM })] : []),
        ],
      }),
      Text('meocord.meoverse.com', { fontFamily: 'JetBrains Mono', fontSize: 22, color: DIM }),
    ],
  })
  try {
    const buffer = await canvas.toBuffer('png')
    return { png: buffer.toString('base64'), engine: canvas.engine }
  } finally {
    canvas.release()
  }
}
