import { Button, Code, Div, type NodeInstance, Span } from '@meonode/ui'
import { resolveExample } from '../../../scripts/lib/pages'
import { playgroundFor, readPlaygroundManifest } from '@/lib/playground-manifest'
import { codeFrame } from '@/lib/prose/code'
import type { PlaygroundDirective } from '@/lib/prose/lower'
import { parseDispatchList } from '@/playground/dispatch-list'

// Read once when a build renders the pages: the built HTML names the frame, and the server never reads it again.
// A dev server reads it for every page, so a `playground:build` run after it started is picked up.
let manifest: ReturnType<typeof readPlaygroundManifest> | null = null
const lineFrame = (line: string) => {
  if (manifest === null || process.env.NODE_ENV !== 'production') manifest = readPlaygroundManifest()
  return playgroundFor(manifest, line)?.frame
}

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
  { page, frameOf = lineFrame }: { page?: string; frameOf?: (line: string) => string | undefined } = {},
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
        ],
      }),
      Div({ key: 'output', 'data-playground-output': true, 'aria-live': 'polite' }),
    ],
  })
}
