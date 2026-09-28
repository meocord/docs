import { Button, Div, H1, Node, type NodeInstance, P, Span } from '@meonode/ui'
import { Prose } from '@/components/nodes'
import { PlaygroundPageIsland } from '@/components/prose/PlaygroundPageIsland'
import { Window } from '@/components/shell/Window'
import { VERSIONS } from '@/config/versions'
import { guideEntries, guidePageHref, guideTabs, hasPlaygroundPage } from '@/lib/docs/guide-site'
import { playgroundFrame } from '@/lib/docs/playground-site'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'
import { escapeAttribute, escapeHtml } from '@/lib/html'
import { docsHref } from '@/lib/urls'
import { withoutCode } from '../../../scripts/lib/content'
import { guidePath } from '../../../scripts/lib/guide'
import { resolveExample } from '../../../scripts/lib/pages'

/** A `::playground` of a line's Guide, as the playground page offers it to start from. */
export interface GuidePlayground {
  /** The page that embeds it. */
  title: string
  href: string
  file: string
  region?: string
  dispatch: string
  /** The whole file, as Run runs it. */
  source: string
}

const PLAYGROUND = /^::playground\{([^}]*)\}\s*$/gm

/** Every `::playground` in a line's Guide, in reading order. */
export function guidePlaygrounds(line: string): GuidePlayground[] {
  return guideEntries(line).flatMap(({ page, body }) =>
    [...withoutCode(body).matchAll(PLAYGROUND)].flatMap(match => {
      const values = Object.fromEntries(
        [...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
      )
      if (!values.file || values.dispatch === undefined) return []
      return [
        {
          title: page.title,
          href: guidePageHref(line, page),
          file: values.file,
          region: values.region,
          dispatch: values.dispatch,
          source: resolveExample(line, values.file, undefined, { page: guidePath(page) }),
        },
      ]
    }),
  )
}

/**
 * A line's playground: an editor for code and the inputs to dispatch, started from one of the Guide's
 * playgrounds, a Run button, a button that copies a link carrying both, and the result. The code runs as
 * the Guide's playgrounds do, in the sandboxed frame. Without script it shows the first example, and the
 * buttons stay hidden, since they do nothing without it.
 */
export function renderPlaygroundPage(line: string): NodeInstance | undefined {
  const frame = playgroundFrame(line)
  if (!hasPlaygroundPage(line) || !frame) return undefined
  const examples = guidePlaygrounds(line)
  const [first] = examples
  // The fields are written as markup React doesn't manage, and the island owns them from then on. As React
  // elements, hydration would put each back to its first value, dropping what a reader typed before it.
  const attributes = (values: Record<string, string>) =>
    Object.entries(values)
      .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
      .join('')
  const field = (id: string, label: string, control: string, hint = '') =>
    `<div data-playground-field><label for="${id}">${escapeHtml(label)}</label>${control}${hint}</div>`
  const typing = { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off' }
  const fields = [
    examples.length > 1
      ? field(
          'playground-example',
          'Start from',
          `<select id="playground-example">${examples
            .map(
              (example, index) =>
                `<option${attributes({ value: String(index), 'data-source': example.source, 'data-dispatch': example.dispatch })}>${escapeHtml(`${example.title}: ${example.file}`)}</option>`,
            )
            .join('')}</select>`,
        )
      : '',
    field(
      'playground-code',
      'Code',
      // A newline after the tag, which the parser drops, so a first line that is blank survives
      `<textarea${attributes({ id: 'playground-code', rows: '22', wrap: 'off', ...typing })}>\n${escapeHtml(first?.source ?? '')}</textarea>`,
    ),
    field(
      'playground-inputs',
      'Inputs',
      `<input${attributes({ id: 'playground-inputs', type: 'text', ...typing, 'aria-describedby': 'playground-inputs-hint', value: first?.dispatch ?? '' })}>`,
      `<p id="playground-inputs-hint" data-playground-quiet>${escapeHtml(
        "Steps separated by ;, such as /ping, /settings notify email enabled:true, button counter/1, select pick a,b, userselect assign/7 13,14, modal feedback about='bugs', message !ping, reaction ⭐ on 'nice post' or event guildMemberAdd. Ctrl+Enter or ⌘+Enter runs.",
      )}</p>`,
    ),
  ].join('')

  return Window({
    crumbs: [{ title: line, href: docsHref({ kind: 'line', line }, VERSIONS) }, { title: 'Playground' }],
    groups: sidebar(line, 'playground'),
    tabs: guideTabs(line, 'guide'),
    version: versionChoices(line),
    repository: REPOSITORY,
    toc: [],
    children: Prose({
      children: [
        H1('Playground', { key: 'title' }),
        P(
          `Write a controller, name the interactions to send it, and run it: MeoCord ${line}'s own dispatch handles them, with its guards, pipes, cooldowns and filters, and the playground shows what the handlers answered. It all runs in your browser.`,
          { key: 'intro' },
        ),
        Div({
          key: 'playground',
          'data-playground-page': true,
          'data-playground-src': frame,
          children: [
            Div({ key: 'fields', 'data-playground-fields': true, dangerouslySetInnerHTML: { __html: fields } }),
            Div({
              key: 'bar',
              'data-playground-bar': true,
              children: [
                Button('Run', { key: 'run', type: 'button', hidden: true, 'data-playground-run': true }),
                Button('Copy link', { key: 'share', type: 'button', hidden: true, 'data-playground-share': true }),
                Span('', { key: 'status', 'data-playground-status': true, role: 'status' }),
              ],
            }),
            Div({ key: 'output', 'data-playground-output': true, 'aria-live': 'polite' }),
          ],
        }),
        Node(PlaygroundPageIsland, { key: 'island' }),
      ],
    }),
  })
}
