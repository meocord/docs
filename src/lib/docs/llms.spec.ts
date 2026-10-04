import { describe, expect, it } from 'vitest'
import { SITE_URL } from '@/config/site'
import { CURRENT_LINE, VERSIONS } from '@/config/versions'
import { guideEntries, guidePageHref } from '@/lib/docs/guide-site'
import { LLMS_FULL_PATH, llmsFull, llmsIndex, transform } from '@/lib/docs/llms'
import { indexedPaths } from '@/lib/docs/sitemap'
import { docsHref } from '@/lib/urls'
import { guidePath } from '../../../scripts/lib/guide'
import { resolveExample } from '../../../scripts/lib/pages'

const line = CURRENT_LINE
const page = { path: 'guards', href: docsHref({ kind: 'guide', line, slug: 'guards' }, VERSIONS) }
const url = (path: string) => `${SITE_URL}${path}`

// Every link to the site, without its anchor, and every fenced code block's opening line
const siteLinks = (markdown: string) =>
  [...markdown.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)]
    .map(match => match[1])
    .filter(link => link.startsWith(SITE_URL))
    .map(link => new URL(link).pathname)
const fences = (markdown: string) => markdown.match(/^ *`{3,}ts title=.*$/gm) ?? []

describe('a Guide page as Markdown', () => {
  it('shows an ::example as the code the page shows, titled with its file', () => {
    const file = 'controllers/slash/search.slash.controller.ts'
    const markdown = transform(line, `Before.\n\n::example{file="${file}" region="controller"}\n\nAfter.`, page)
    expect(markdown).toContain(
      `\`\`\`ts title="${file}"\n${resolveExample(line, file, 'controller', { page: 'guards' })}`,
    )
    expect(markdown).not.toContain('::example')
  })

  it('shows a ::playground as the code it runs', () => {
    const file = 'controllers/slash/search.slash.controller.ts'
    const markdown = transform(
      line,
      `::playground{file="${file}" region="controller" dispatch="/search query:x"}`,
      page,
    )
    expect(fences(markdown)).toEqual([`\`\`\`ts title="${file}"`])
  })

  it('draws the pipeline figure as a list of its stages, each linked to its page', () => {
    const markdown = transform(line, '::figure{name="pipeline"}', page)
    expect(markdown).toMatch(/^1\. \[Observers: onStart\]\(https:\/\/\S+\/observers\)/m)
    expect(markdown).toMatch(/^ {3}\d+\. \[Guards\]/m)
    expect(markdown).not.toMatch(/\]\((guide|api):/)
  })

  it('makes every link absolute: guide: and api: as the page resolves them, and an anchor on its own page', () => {
    const markdown = transform(
      line,
      'See [services](guide:services#providers), [`@UseGuard`](api:decorators/UseGuard) and [below](#refusing-a-call).',
      page,
    )
    expect(markdown).toContain(
      `(${url(docsHref({ kind: 'guide', line, slug: 'services', anchor: 'providers' }, VERSIONS))})`,
    )
    expect(markdown).toMatch(/\(https:\/\/\S+\/api\/decorators\/UseGuard\)/)
    expect(markdown).toContain(`(${url(page.href)}#refusing-a-call)`)
  })

  it('writes an alert with the label the page shows, not GitHub syntax', () => {
    expect(transform(line, '> [!WARNING]\n> Keep the token secret.', page)).toBe(
      '> **Warning:** Keep the token secret.\n',
    )
  })

  it('refuses a directive the site does not know, so none is served as written', () => {
    expect(() => transform(line, '::diagram{name="x"}', page)).toThrow(/no directive the site knows/)
    expect(() => transform(line, '::figure{name="nothing"}', page)).toThrow(/names no figure/)
  })
})

describe('llms.txt and llms-full.txt', () => {
  const index = llmsIndex(line)
  const full = llmsFull(line)
  const indexed = new Set(indexedPaths())

  it('open with an H1 and the summary in a blockquote, as llmstxt.org asks', () => {
    expect(index).toMatch(/^# MeoCord\n\n> \S/)
    expect(full).toMatch(/^# MeoCord \d+\.\d+ Guide\n\n> \S/)
  })

  it('link only pages search engines may index, and llms-full.txt', () => {
    const unknown = [...siteLinks(index), ...siteLinks(full)].filter(
      path => !indexed.has(path) && path !== LLMS_FULL_PATH,
    )
    expect([...new Set(unknown)]).toEqual([])
  })

  it('list every page of the Guide, each with its summary, and hold each in full', () => {
    for (const { page: guide } of guideEntries(line)) {
      const href = url(guidePageHref(line, guide))
      expect(index).toContain(`- [${guide.title}](${href}): ${guide.summary}`)
      expect(full).toContain(`# ${guide.title}\n\n> ${guide.summary}\n\nURL: ${href}\n`)
    }
  })

  it('leave no guide: or api: link, directive or GitHub alert as written', () => {
    for (const markdown of [index, full]) {
      expect(markdown).not.toMatch(/\]\((guide|api):/)
      expect(markdown).not.toMatch(/^ *::[a-z]/m)
      expect(markdown).not.toMatch(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/)
      expect(markdown).not.toMatch(/\]\(#/)
    }
  })

  it('show the code of every example and playground a page embeds', () => {
    for (const { page: guide, body } of guideEntries(line)) {
      const directives = body.match(/^ *::(example|playground)\{/gm) ?? []
      const at = { path: guidePath(guide), href: guidePageHref(line, guide) }
      expect(fences(transform(line, body, at)), guidePath(guide)).toHaveLength(directives.length)
    }
  })
})
