import { A, Button, Code, Div, type NodeInstance, Span } from '@meonode/ui'
import { resolveExample } from '../../../scripts/lib/pages'
import { VERSIONS } from '@/config/versions'
import { playgroundFrame } from '@/lib/docs/playground-site'
import { sharedFragment } from '@/lib/docs/share-link'
import { docsHref } from '@/lib/urls'
import { codeFrame } from '@/lib/prose/code'
import type { PlaygroundDirective } from '@/lib/prose/lower'
import { parseDispatchList } from '@/playground/dispatch-list'

/**
 * A `::playground` on a Guide page: the code frame of its region, a Run button, the inputs it dispatches,
 * and an empty region the result is shown in. The whole file and its inputs ride on the element, for the
 * runner to post. Without the line's runtime, as in a dev server started without `playground:build`, it
 * is the code frame alone, marked so the post-build check refuses a production build that shipped one.
 */
export function playgroundEmbed(
  line: string,
  directive: PlaygroundDirective,
  key: number,
  { page, frameOf = playgroundFrame }: { page?: string; frameOf?: (line: string) => string | undefined } = {},
): NodeInstance {
  const list = parseDispatchList(directive.dispatch)
  if (typeof list === 'string') throw new Error(`::playground{file="${directive.file}"}: ${list}`)
  const shown = codeFrame(resolveExample(line, directive.file, directive.region, { page }), 'ts', {
    key: 0,
    file: directive.file,
  })
  const frame = frameOf(line)
  if (!frame) return Div({ key, 'data-playground-embed': true, 'data-playground-unavailable': true, children: shown })
  const inputs = `playground-inputs-${key}`
  const request = {
    source: resolveExample(line, directive.file, undefined, { page }),
    dispatch: list.steps,
    ...(list.caller && { caller: list.caller }),
  }
  return Div({
    key,
    'data-playground-embed': true,
    'data-playground-src': frame,
    'data-playground-request': JSON.stringify(request),
    children: [
      shown,
      Div({
        key: 'bar',
        'data-playground-bar': true,
        children: [
          // Described by its inputs, so a page's several Run buttons are told apart
          Button('Run', {
            key: 'run',
            type: 'button',
            hidden: true,
            'data-playground-run': true,
            'aria-describedby': inputs,
          }),
          Span(['Dispatches ', Code(directive.dispatch, { key: 'dispatch' })], { key: 'inputs', id: inputs }),
          // The playground page reads the code from the link with script, so the link shows with it
          A({
            key: 'open',
            children: 'Open in playground',
            href: docsHref(
              {
                kind: 'playground',
                line,
                code: sharedFragment(
                  { source: request.source, dispatch: directive.dispatch },
                  `examples/${line}/src/${directive.file}`,
                ),
              },
              VERSIONS,
            ),
            hidden: true,
            'data-playground-open': true,
          }),
        ],
      }),
      Div({ key: 'output', 'data-playground-output': true, 'aria-live': 'polite' }),
    ],
  })
}
