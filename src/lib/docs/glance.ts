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
 * The parameters a declaration lists, as written: `...entries`, `options?`. Read from the code, where the
 * list's own commas are those outside any brackets, so a function type inside a parameter doesn't split it.
 */
function paramsOf(code: string, name: string): string[] {
  let at = code.indexOf(name) + name.length
  const skip = (close: string) => {
    let depth = 0
    const start = at
    for (; at < code.length; at++) {
      const char = code[at]!
      if (char === '>' && code[at - 1] === '=') continue
      if ('([{<'.includes(char)) depth++
      else if (')]}>'.includes(char)) depth--
      if (depth === 0 && char === close) return code.slice(start + 1, at++)
    }
    return undefined
  }
  if (code[at] === '<') skip('>')
  const list = code[at] === '(' ? skip(')') : undefined
  if (!list?.trim()) return []
  const params: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < list.length; i++) {
    const char = list[i]!
    if (char === '>' && list[i - 1] === '=') {
      current += char
      continue
    }
    if ('([{<'.includes(char)) depth++
    else if (')]}>'.includes(char)) depth--
    if (char === ',' && depth === 0) {
      params.push(current)
      current = ''
    } else current += char
  }
  params.push(current)
  return params.flatMap(param => {
    const match = /^\s*(\.\.\.)?([A-Za-z_$][\w$]*)(\?)?/.exec(param)
    return match ? [`${match[1] ?? ''}${match[2]}${match[3] ?? ''}`] : []
  })
}

/** How a signature is called: its name and its parameters' names, as `send(payload, options?)`. */
export function callShape(name: string, signature: ApiSignature): string {
  return `${name}(${paramsOf(signature.code.map(token => token.text).join(''), name).join(', ')})`
}

/** The first sentence of a summary: up to a full stop before the next sentence, or all of it. */
export function firstSentence(markdown: string): string {
  const text = markdown
    .split(/\n\s*\n/)[0]!
    .replace(/\s+/g, ' ')
    .trim()
  return /^.*?[.!?](?=\s+[A-Z`[(*])/.exec(text)?.[0] ?? text
}
