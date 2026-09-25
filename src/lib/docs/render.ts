import { Div, Node } from '@meonode/ui'
import { Prose } from '@/components/prose/Prose'
import { ReadingIsland } from '@/components/prose/ReadingIsland'
import { Window } from '@/components/shell/Window'
import { guidePage, readmeVersion, sidebar, versionChoices } from '@/lib/docs/site'

export const REPOSITORY = 'https://github.com/meocord/meocord'

/** A line's guide in the docs window; undefined when the line has no such page. */
export function renderGuide(line: string, slug: string) {
  const page = guidePage(line, slug)
  if (!page) return undefined
  const readme = readmeVersion(page.entry)

  return Window({
    crumbs: page.crumbs,
    groups: sidebar(line, slug),
    version: versionChoices(line, page.entry.id),
    repository: REPOSITORY,
    toc: page.toc,
    children: Prose({
      children: [
        Node('h1', { key: 'title', children: page.entry.title }),
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
