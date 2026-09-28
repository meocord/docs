/**
 * A run's result as the page shows it, under the playground's code. Everything in a result comes from
 * the reader's code, so it is only ever set as text: this module builds elements and sets textContent,
 * never markup.
 */
import type { LogLine, RunResult, Step } from '../runtime/protocol'
import { describeInput, FAILED_STAGE_LABELS, summarizeCall } from './describe'

type Attributes = Record<string, string | true>

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: (Node | string | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value === true ? '' : value)
  for (const child of children) if (child !== undefined) node.append(child)
  return node
}

/** A value shown as JSON, behind a disclosure, for a reader who wants every field. */
const disclosure = (label: string, value: unknown) =>
  element('details', {}, element('summary', {}, label), scrolling(JSON.stringify(value, null, 2)))

/** A block of text that scrolls, so it takes focus: a keyboard reader scrolls it too. */
const scrolling = (text: string) => element('pre', { tabindex: '0' }, text)

function stepView(step: Step): HTMLLIElement {
  const handlers = step.handlers.length > 0 ? step.handlers.join(', ') : 'no handler'
  const calls =
    step.calls.length > 0
      ? element(
          'ul',
          { 'data-playground-calls': true },
          ...step.calls.map(call => {
            const summary = summarizeCall(call)
            return element(
              'li',
              {},
              element('code', {}, call.method),
              summary ? ` ${summary}` : undefined,
              call.payload !== undefined ? disclosure('Payload', call.payload) : undefined,
            )
          }),
        )
      : element('p', { 'data-playground-quiet': true }, 'No call to Discord.')
  return element(
    'li',
    { 'data-playground-step': true, 'data-ran': String(step.ran) },
    element('p', { 'data-playground-input': true }, element('code', {}, describeInput(step.input)), ` → ${handlers}`),
    calls,
    step.error
      ? element('p', { 'data-playground-error': true }, `${step.error.name}: ${step.error.message}`)
      : undefined,
  )
}

const logsView = (logs: LogLine[]) =>
  logs.length > 0
    ? element(
        'details',
        { 'data-playground-logs': true },
        element('summary', {}, `Logs (${logs.length})`),
        scrolling(logs.map(line => `${line.level.padEnd(5)} ${line.text}`).join('\n')),
      )
    : undefined

/** Shows `result` in `output`, replacing what was there. */
export function showResult(output: HTMLElement, result: RunResult): void {
  const view = result.ok
    ? element(
        'div',
        { 'data-playground-result': true, 'data-ok': 'true' },
        element('ol', { 'data-playground-steps': true }, ...result.steps.map(stepView)),
        logsView(result.logs),
        result.truncated
          ? element('p', { 'data-playground-quiet': true }, 'Payloads over 2,000 characters are cut.')
          : undefined,
      )
    : element(
        'div',
        { 'data-playground-result': true, 'data-ok': 'false' },
        element(
          'p',
          { 'data-playground-error': true },
          element('strong', {}, FAILED_STAGE_LABELS[result.stage]),
          `: ${result.message}`,
        ),
        logsView(result.logs),
      )
  output.replaceChildren(view)
}

/** Shows a line of status in `output`, such as that the run is under way or couldn't start. */
export function showStatus(output: HTMLElement, text: string, failed = false): void {
  output.replaceChildren(
    element('p', failed ? { 'data-playground-error': true } : { 'data-playground-quiet': true }, text),
  )
}
