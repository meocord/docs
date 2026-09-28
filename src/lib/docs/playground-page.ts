import { Button, Div, H1, Input, Label, Node, type NodeInstance, Option, P, Select, Span, Textarea } from '@meonode/ui'
import { Prose } from '@/components/nodes'
import { PlaygroundPageIsland } from '@/components/prose/PlaygroundPageIsland'
import { Window } from '@/components/shell/Window'
import { VERSIONS } from '@/config/versions'
import { guideEnabled, guideEntries, guidePageHref, guideTabs } from '@/lib/docs/guide-site'
import { playgroundFrame } from '@/lib/docs/playground-site'
import { REPOSITORY } from '@/lib/docs/render'
import { sidebar, versionChoices } from '@/lib/docs/site'
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

/** Whether a line has a playground page: its Guide is rendered, and the build has its runtime. */
export const hasPlaygroundPage = (line: string) => guideEnabled(line) && playgroundFrame(line) !== undefined

/**
 * A line's playground: an editor for code and the inputs to dispatch, started from one of the Guide's
 * playgrounds, a Run button, a button that copies a link carrying both, and the result. The code runs as
 * the Guide's playgrounds do, in the sandboxed frame. Without script it shows the first example, and the
 * buttons stay hidden, since they do nothing without it.
 */
export function renderPlaygroundPage(line: string): NodeInstance | undefined {
  const frame = playgroundFrame(line)
  if (!guideEnabled(line) || !frame) return undefined
  const examples = guidePlaygrounds(line)
  const [first] = examples
  const field = (id: string, label: string, control: NodeInstance, hint?: NodeInstance) =>
    Div({
      key: id,
      'data-playground-field': true,
      children: [Label({ key: 'label', htmlFor: id, children: label }), control, hint],
    })

  return Window({
    crumbs: [{ title: line, href: docsHref({ kind: 'line', line }, VERSIONS) }, { title: 'Playground' }],
    groups: sidebar(line),
    tabs: guideTabs(line, 'playground'),
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
            examples.length > 1
              ? field(
                  'playground-example',
                  'Start from',
                  Select({
                    key: 'control',
                    id: 'playground-example',
                    children: examples.map((example, index) =>
                      Option(`${example.title}: ${example.file}`, {
                        key: String(index),
                        value: String(index),
                        'data-source': example.source,
                        'data-dispatch': example.dispatch,
                      }),
                    ),
                  }),
                )
              : undefined,
            field(
              'playground-code',
              'Code',
              Textarea({
                key: 'control',
                id: 'playground-code',
                rows: 22,
                wrap: 'off',
                spellCheck: false,
                autoCapitalize: 'off',
                autoComplete: 'off',
                autoCorrect: 'off',
                defaultValue: first?.source ?? '',
              }),
            ),
            field(
              'playground-inputs',
              'Inputs',
              Input({
                key: 'control',
                id: 'playground-inputs',
                type: 'text',
                spellCheck: false,
                autoCapitalize: 'off',
                autoComplete: 'off',
                autoCorrect: 'off',
                'aria-describedby': 'playground-inputs-hint',
                defaultValue: first?.dispatch ?? '',
              }),
              P(
                "Steps separated by ;, such as /ping, /settings notify email enabled:true, button counter/1, select pick a,b, modal feedback about='bugs' or message !ping. Ctrl+Enter or ⌘+Enter runs.",
                { key: 'hint', id: 'playground-inputs-hint', 'data-playground-quiet': true },
              ),
            ),
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
