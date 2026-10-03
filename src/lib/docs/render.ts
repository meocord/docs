import { A, Aside, Div, H1, H2, Li, Nav, Node, type NodeInstance, P, Span, Ul } from '@meonode/ui'

type Child = NodeInstance | string
import { Prose } from '@/components/nodes'
import { PlaygroundIsland } from '@/components/prose/PlaygroundIsland'
import { ReadingIsland } from '@/components/prose/ReadingIsland'
import { Window } from '@/components/shell/Window'
import { guideEnabled, guideTabs, guideView, resolveGuideLink, type GuideView } from '@/lib/docs/guide-site'
import { guidePage, readmeVersion, sidebar, versionChoices } from '@/lib/docs/site'
import { CHAPTERS, guidePath } from '../../../scripts/lib/guide'

export const REPOSITORY = 'https://github.com/meocord/meocord'

/** A line's guide in the docs window; undefined when the line has no such page. */
export function renderGuide(line: string, slug: string) {
  if (guideEnabled(line)) return renderGuidePage(line, slug)
  const page = guidePage(line, slug)
  if (!page) return undefined
  const readme = readmeVersion(page.entry)

  return Window({
    crumbs: page.crumbs,
    groups: sidebar(line, slug),
    version: versionChoices(line, { page: page.entry, line }),
    repository: REPOSITORY,
    toc: page.toc,
    children: Prose({
      children: [
        H1(page.entry.title, { key: 'title' }),
        // The page's context, muted under its title: the line, the section, and where it came from.
        Div({
          key: 'subtitle',
          'data-subtitle': true,
          children: [
            `MeoCord ${line}`,
            page.entry.section,
            page.entry.since ? `since ${page.entry.since}` : undefined,
            readme ? `from the README of meocord ${readme}` : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
        }),
        ...page.lowered.nodes,
        Node(ReadingIsland, { key: 'island' }),
      ],
    }),
  })
}

/**
 * A Guide page's content: its title and summary, what it teaches and what to read first, its body, the
 * API entries it covers, what the example bots show of it, and the pages before and after it in reading order.
 */
export function guideArticle(line: string, view: GuideView): Child[] {
  const { page } = view
  const chapter = CHAPTERS.find(candidate => candidate.id === page.chapter)!
  const list = (key: string, items: { title: string; href: string }[]) =>
    Ul({
      key,
      children: items.map(item => Li({ key: item.href, children: A({ href: item.href, children: item.title }) })),
    })
  return [
    H1(page.title, { key: 'title' }),
    Div({
      key: 'subtitle',
      'data-subtitle': true,
      children: [
        `MeoCord ${line}`,
        page.chapter === 'appendix' ? undefined : chapter.title,
        view.progress ? `page ${view.progress.index} of ${view.progress.total}` : undefined,
        page.since ? `since ${page.since}` : undefined,
      ]
        .filter(Boolean)
        .join(' · '),
    }),
    P(page.summary, { key: 'summary', 'data-summary': true }),
    page.learn.length > 0 || view.requires.length > 0
      ? Div({
          key: 'intro',
          'data-guide-intro': true,
          children: [
            page.learn.length > 0
              ? Div({
                  key: 'learn',
                  children: [
                    P("You'll learn", { key: 'label', 'data-guide-label': true }),
                    Ul({ key: 'list', children: page.learn.map(item => Li({ key: item, children: item })) }),
                  ],
                })
              : null,
            view.requires.length > 0
              ? Div({
                  key: 'requires',
                  children: [P('Before this', { key: 'label', 'data-guide-label': true }), list('list', view.requires)],
                })
              : null,
          ],
        })
      : null,
    ...view.lowered.nodes,
    page.api.length > 0
      ? Aside({
          key: 'api',
          'data-guide-api': true,
          'aria-labelledby': 'guide-api',
          children: [
            H2('API', { key: 'heading', id: 'guide-api' }),
            list(
              'list',
              page.api.map(entry => ({
                title: entry.split('/')[1].replace('#', '.'),
                href: resolveGuideLink(line, `api:${entry}`),
              })),
            ),
          ],
        })
      : null,
    view.bots
      ? Aside({
          key: 'bots',
          'data-guide-bots': true,
          'aria-labelledby': 'guide-bots',
          children: [H2('Example bots', { key: 'heading', id: 'guide-bots' }), ...view.bots],
        })
      : null,
    view.previous || view.next
      ? Nav({
          key: 'pager',
          'data-pager': true,
          'aria-label': 'Previous and next',
          children: [
            view.previous
              ? A({
                  key: 'previous',
                  href: view.previous.href,
                  rel: 'prev',
                  children: [Span('Previous', { key: 'label' }), Span(view.previous.title, { key: 'title' })],
                })
              : Span(null, { key: 'previous' }),
            view.next
              ? A({
                  key: 'next',
                  href: view.next.href,
                  rel: 'next',
                  children: [Span('Next', { key: 'label' }), Span(view.next.title, { key: 'title' })],
                })
              : null,
          ],
        })
      : null,
  ].filter((node): node is NodeInstance => node !== null)
}

/** A page of a line's Guide in the docs window; undefined when the Guide has no such page. */
export function renderGuidePage(line: string, pagePath: string) {
  const view = guideView(line, pagePath)
  if (!view) return undefined
  return Window({
    crumbs: view.crumbs,
    groups: sidebar(line, guidePath(view.page)),
    tabs: guideTabs(line, 'guide'),
    version: versionChoices(line, { page: view.page, line }),
    repository: REPOSITORY,
    toc: view.toc,
    children: Prose({
      children: [
        ...guideArticle(line, view),
        Node(ReadingIsland, { key: 'island' }),
        ...(view.playgrounds > 0 ? [Node(PlaygroundIsland, { key: 'playground' })] : []),
      ],
    }),
  })
}
