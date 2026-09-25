import { createHash } from 'node:crypto'

/** What a card says. Everything that changes the image belongs here, so it changes the hash. */
export interface OgCard {
  /** The small label above the title, such as the section. */
  eyebrow: string
  title: string
  /** The version or line shown on the card, as a "since" chip. */
  version?: string
  /** One or two lines under the title. */
  summary?: string
  /** One line of code set in the accent: the page's key symbol, or its signature. */
  code?: string
}

/**
 * The cards, by line then page id. A placeholder registry holding the home card, until pages carry
 * their own. `site` is the line for pages outside any docs line.
 */
const CARDS: Record<string, Record<string, OgCard>> = {
  site: {
    home: {
      eyebrow: 'Documentation',
      title: 'Decorator-based Discord bots, with the pipeline you’d build yourself.',
      code: 'npx meocord create my-bot',
    },
  },
}

/** Bumped when the card's drawing changes, so every URL changes with it. */
const DESIGN_REVISION = 3

export function findCard(line: string, id: string): OgCard | undefined {
  return Object.hasOwn(CARDS, line) && Object.hasOwn(CARDS[line], id) ? CARDS[line][id] : undefined
}

/** The content hash in a card's URL: 12 hex characters of its content and the design revision. */
export function cardHash(card: OgCard): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        DESIGN_REVISION,
        card.eyebrow,
        card.title,
        card.version ?? null,
        card.summary ?? null,
        card.code ?? null,
      ]),
    )
    .digest('hex')
    .slice(0, 12)
}

/**
 * A card's path. The hash is in the path, not the query, because some CDNs drop the query from the
 * cache key, and the response is immutable.
 */
export function ogPath(line: string, id: string): string {
  const card = findCard(line, id)
  if (!card) throw new Error(`No OG card for ${line}/${id}.`)
  return `/og/${line}/${id}.${cardHash(card)}.png`
}

/** The Open Graph image entry for a card. */
export function ogImage(line: string, id: string) {
  return { url: ogPath(line, id), width: 1200, height: 630, alt: findCard(line, id)!.title.replace(/\n/g, ' ') }
}

/** Splits `<id>.<hash>.png`, or undefined when the name is not in that shape. */
export function parseCardFile(file: string): { id: string; hash: string } | undefined {
  const match = /^([a-z0-9][a-z0-9-]*)\.([0-9a-f]{12})\.png$/.exec(file)
  return match ? { id: match[1], hash: match[2] } : undefined
}
