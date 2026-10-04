import type { Code, Nodes, Paragraph, Parents, Root, RootContent } from 'mdast'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { SITE_DESCRIPTION, SITE_URL } from '@/config/site'
import { VERSIONS } from '@/config/versions'
import { apiModel, apiSections } from '@/lib/docs/api-site'
import { FIGURES } from '@/lib/docs/figures'
import { guideEntries, guidePageHref, guideSidebar, resolveGuideLink } from '@/lib/docs/guide-site'
import { hasMigrating, lineChangelog } from '@/lib/docs/reference-pages'
import { parseMarkdown } from '@/lib/prose/anchors'
import { ALERT, ALERTS, directiveOf } from '@/lib/prose/lower'
import { docsHref } from '@/lib/urls'
import { guidePath } from '../../../scripts/lib/guide'
import { resolveExample } from '../../../scripts/lib/pages'

/** Where the whole Guide is served as one file, which llms.txt links. */
export const LLMS_FULL_PATH = '/llms-full.txt'

/** A path on the site as an absolute URL; any other URL as it is. */
const absolute = (href: string) => (href.startsWith('/') ? new URL(href, SITE_URL).toString() : href)

// A paragraph that opens like a directive, `::name{…}`, but is none the site knows
const DIRECTIVE_LIKE = /^::[a-z]/

const serialize = (tree: Root) =>
  toMarkdown(tree, {
    extensions: [gfmToMarkdown()],
    bullet: '-',
    fences: true,
    listItemIndent: 'one',
    rule: '-',
  })

/** One line of Markdown with its links absolute, as a list item's note: a doc comment's first paragraph. */
function inline(line: string, markdown: string): string {
  return transform(line, markdown)
    .trim()
    .replace(/\s*\n\s*/g, ' ')
}

/** A Guide page as `transform` places it: its path, for examples and errors, and its own URL, for links to its anchors. */
export interface PageAt {
  path: string
  href: string
}

/**
 * A Guide page's body as standalone Markdown, as the page reads: each `::example` and `::playground` the code it
 * shows, in a `ts` block titled with its file; each `::figure` its Markdown form; every link absolute, `guide:` and
 * `api:` ones resolved as the page resolves them, and one to an anchor of the page given its URL. A directive the site
 * doesn't know throws, so none reaches a reader as written.
 */
export function transform(line: string, body: string, page?: PageAt): string {
  const tree = parseMarkdown(body)
  const pagePath = page?.path ?? 'markdown'
  const href = (url: string) =>
    absolute(url.startsWith('#') && page ? `${page.href}${url}` : resolveGuideLink(line, url))
  const example = (file: string | undefined, region?: string, from?: string): Code[] => {
    if (!file) throw new Error(`${pagePath}: a directive names no file.`)
    const value = resolveExample(from ?? line, file, region, { page: page?.path })
    return [{ type: 'code', lang: 'ts', meta: `title="${file}"`, value }]
  }

  function replace(node: Paragraph): RootContent[] | undefined {
    const directive = directiveOf(node)
    if (directive?.kind === 'example') return example(directive.file, directive.region, directive.from)
    if (directive?.kind === 'playground') return example(directive.file, directive.region)
    if (directive?.kind === 'figure') {
      const figure = FIGURES[directive.name]
      if (!figure) throw new Error(`${pagePath}: ::figure{name="${directive.name}"} names no figure.`)
      return parseMarkdown(figure.markdown(url => url)).children.map(rewrite)
    }
    const [first] = node.children
    if (first?.type === 'text' && DIRECTIVE_LIKE.test(first.value.trim()))
      throw new Error(`${pagePath}: "${first.value.trim()}" is no directive the site knows.`)
    return undefined
  }

  function rewrite<T extends Nodes>(node: T): T {
    if (node.type === 'link' || node.type === 'definition') node.url = href(node.url)
    // An alert reads as the page shows it, its label first, since `[!NOTE]` means nothing outside GitHub
    if (node.type === 'blockquote') {
      const [first] = node.children
      const text = first?.type === 'paragraph' && first.children[0]?.type === 'text' ? first.children[0] : undefined
      const alert = text && ALERT.exec(text.value)
      if (first?.type === 'paragraph' && text && alert) {
        text.value = text.value.slice(alert[0].length)
        const label = ALERTS[alert[1] as keyof typeof ALERTS].label
        first.children.unshift(
          { type: 'strong', children: [{ type: 'text', value: `${label}:` }] },
          { type: 'text', value: ' ' },
        )
      }
    }
    if ('children' in node) {
      const parent = node as Parents
      parent.children = parent.children.flatMap(child =>
        child.type === 'paragraph' ? (replace(child) ?? [rewrite(child)]) : [rewrite(child)],
      ) as Parents['children']
    }
    return node
  }

  return serialize(rewrite(tree))
}

const item = (title: string, url: string, note?: string) => `- [${title}](${absolute(url)})${note ? `: ${note}` : ''}`

/**
 * llms.txt for a line: what MeoCord is, then a link to every page of its Guide by chapter, as the sidebar
 * groups them, and to every entry of its API reference by kind, each with its summary. The upgrade guide and the
 * changelog close it, under the `Optional` section a reader short of context may skip.
 */
export function llmsIndex(line: string): string {
  const pages = new Map(guideEntries(line).map(({ page }) => [guidePageHref(line, page), page]))
  const guide = guideSidebar(line).flatMap(group => {
    const items = group.items.flatMap(entry => {
      const page = pages.get(entry.href)
      return page ? [item(page.title, entry.href, page.summary)] : []
    })
    return items.length > 0 ? ['', `## ${group.title}`, '', ...items] : []
  })
  const model = apiModel(line)
  const api = (model ? apiSections(model) : []).flatMap(section => [
    '',
    `## API: ${section.title}`,
    '',
    ...section.symbols.map(symbol =>
      item(
        symbol.deprecated ? `${symbol.name} (deprecated)` : symbol.name,
        symbol.href,
        inline(line, symbol.summary) || undefined,
      ),
    ),
  ])
  const optional = [
    ...(hasMigrating(line)
      ? [
          item(
            `Upgrading to ${line}`,
            docsHref({ kind: 'migrating', line }, VERSIONS),
            'What changed from the previous line, and what an upgrading bot does about it.',
          ),
        ]
      : []),
    ...(lineChangelog(line).length > 0
      ? [
          item(
            'Changelog',
            docsHref({ kind: 'changelog', line }, VERSIONS),
            `Every release of ${line}, and what each one changed.`,
          ),
        ]
      : []),
  ]
  return [
    '# MeoCord',
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    `These are the docs of MeoCord ${line}, the current release, on ${SITE_URL}. The whole Guide, its examples' code ` +
      `included, is one file at ${absolute(LLMS_FULL_PATH)}.`,
    ...guide,
    ...api,
    ...(optional.length > 0 ? ['', '## Optional', '', ...optional] : []),
    '',
  ].join('\n')
}

/**
 * llms-full.txt for a line: every page of its Guide in reading order, each its title, summary, URL, its body as
 * `transform` gives it, and the API entries it covers.
 */
export function llmsFull(line: string): string {
  const pages = guideEntries(line).map(({ page, body }) => {
    const url = absolute(guidePageHref(line, page))
    const api = page.api.map(
      entry => `[${entry.split('/')[1].replace('#', '.')}](${absolute(resolveGuideLink(line, `api:${entry}`))})`,
    )
    return [
      `# ${page.title}`,
      '',
      `> ${page.summary}`,
      '',
      `URL: ${url}`,
      '',
      transform(line, body, { path: guidePath(page), href: guidePageHref(line, page) }).trim(),
      ...(api.length > 0 ? ['', `API: ${api.join(', ')}`] : []),
    ].join('\n')
  })
  return [
    `# MeoCord ${line} Guide`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    `Every page of the MeoCord ${line} Guide, from ${SITE_URL}, in reading order. Its index, with the API reference, ` +
      `is ${absolute('/llms.txt')}.`,
    '',
    pages.join('\n\n---\n\n'),
    '',
  ].join('\n')
}
