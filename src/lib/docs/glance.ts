import { VERSIONS } from '@/config/versions'
import type { ApiSection, ApiSignature } from '@/lib/docs/api-model'
import { docsHref } from '@/lib/urls'

/** The by-kind API section of the cheat sheets: `/docs/<line>/api/glance/<topic>`. */
export const GLANCE_SECTION = 'glance'

/** The cheat sheets, in the order the API lists them. Each is generated from the API or the CLI's manifest. */
export const GLANCE_TOPICS = [
  {
    slug: 'decorators',
    title: 'Decorators',
    summary: 'Every decorator, how it is called and what it does, by what it applies to.',
  },
  {
    slug: 'respond',
    title: 'respond()',
    summary: 'What `respond(interaction)` gives a handler: each method and property of the response state.',
  },
  {
    slug: 'testing',
    title: 'Testing helpers',
    summary: 'Every helper `meocord/testing` exports, how it is called and what it does.',
  },
  {
    slug: 'cli',
    title: 'CLI',
    summary: 'Every command of the CLI, what it does, and an example to copy.',
  },
] as const

export type GlanceTopic = (typeof GLANCE_TOPICS)[number]

export const glanceTopic = (slug: string): GlanceTopic | undefined => GLANCE_TOPICS.find(topic => topic.slug === slug)

/** A cheat sheet's page. */
export const glanceHref = (line: string, topic: string) =>
  docsHref({ kind: 'api', line, section: GLANCE_SECTION, symbol: topic }, VERSIONS)

/** The cheat sheets as a section of the by-kind API, listed first. */
export function glanceSection(line: string): ApiSection {
  return {
    slug: GLANCE_SECTION,
    title: 'At a glance',
    symbols: GLANCE_TOPICS.map(topic => ({
      name: topic.title,
      kind: 'cheat sheet',
      href: glanceHref(line, topic.slug),
      deprecated: false,
      summary: topic.summary,
    })),
  }
}

/**
 * How a signature is called: its name and its own parameters, as the model records them from TypeScript,
 * with `...` on a rest parameter and `?` on an optional or defaulted one: `send(payload, options?)`. An
 * options parameter's rows and a `this` parameter aren't arguments, and a destructured one reads `{ … }`.
 */
export function callShape(name: string, signature: ApiSignature): string {
  const params = signature.params
    .filter(param => !param.option && param.name !== 'this')
    .map(param => `${param.name === '__namedParameters' ? '{ … }' : param.name}${param.optional ? '?' : ''}`)
  return `${name}(${params.join(', ')})`
}

/** The first sentence of a summary: up to a full stop before the next sentence, or all of it. */
export function firstSentence(markdown: string): string {
  const text = markdown
    .split(/\n\s*\n/)[0]!
    .replace(/\s+/g, ' ')
    .trim()
  return /^.*?[.!?](?=\s+[A-Z`[(*])/.exec(text)?.[0] ?? text
}
