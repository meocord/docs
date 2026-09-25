/**
 * How the reference lays out code that runs long: which TypeScript each kind of display is formatted
 * as, and how wide. `bun run api:layout` formats with Prettier before `next build`; the pages read
 * the result and fall back to one line for a display it has not seen.
 */

/** Where code is displayed: a declaration or member block, a Returns block, or a parameter's cell. */
export type LayoutForm = 'declaration' | 'member' | 'returns' | 'param'

/** Formatted displays, keyed by `layoutKey`. */
export type Layouts = Record<string, string>

/** Columns each form is formatted to: a block's width at the prose measure, a table cell's. */
export const LAYOUT_WIDTH: Record<LayoutForm, number> = { declaration: 80, member: 80, returns: 80, param: 44 }

export const layoutKey = (form: LayoutForm, text: string) => `${form}\0${text}`

/** Code around a display that makes it TypeScript a formatter or highlighter reads. */
export interface Wrapper {
  before: string
  after: string
  /** Put before each line of the display, and taken off each line of the formatted result. */
  indent: string
}

/** The TypeScript a display is written as, from its form and how its text starts. */
export function wrapper(form: LayoutForm, text: string): Wrapper {
  if (form === 'returns' || form === 'param') return { before: 'type T = ', after: '', indent: '' }
  if (form === 'member') return { before: 'declare class C {\n', after: '\n}', indent: '  ' }
  if (/^(type|declare) /.test(text)) return { before: '', after: '', indent: '' }
  if (/^(abstract class|class|interface|enum) /.test(text)) return { before: '', after: ' {}', indent: '' }
  if (/^const /.test(text)) return { before: 'declare ', after: '', indent: '' }
  return { before: 'declare function ', after: '', indent: '' }
}

/** The display inside its wrapper, as one TypeScript source. */
export function wrap(form: LayoutForm, text: string): { source: string; start: number[] } {
  const { before, after, indent } = wrapper(form, text)
  // The source offset of each display character, so what is drawn for the source maps back onto it.
  const start: number[] = []
  let source = before
  text.split('\n').forEach((line, index) => {
    if (index > 0) {
      start.push(source.length)
      source += '\n'
    }
    source += indent
    for (let column = 0; column < line.length; column += 1) start.push(source.length + column)
    source += line
  })
  return { source: source + after, start }
}

/**
 * The display inside its wrapper, as the highlighter reads it: a constructor's `new`, which a class
 * body cannot hold, is read as `get`, a keyword of the same width, so its name and parameters colour.
 */
export function highlightSource(form: LayoutForm, text: string): { source: string; start: number[] } {
  const { source, start } = wrap(form, text)
  if (form !== 'member' || !text.startsWith('new ')) return { source, start }
  return { source: `${source.slice(0, start[0])}get ${source.slice(start[0] + 4)}`, start }
}

/** A formatted source with its wrapper taken off, or undefined when the formatter changed the wrapper. */
export function unwrap(form: LayoutForm, text: string, formatted: string): string | undefined {
  const { before, after } = wrapper(form, text)
  let { indent } = wrapper(form, text)
  const trimmed = formatted.replace(/\n+$/, '')
  // `type T = ` may end its line, the space dropped, when what follows starts on the next.
  const head = before.replace(/ $/, '')
  if (!trimmed.startsWith(head) || !trimmed.endsWith(after)) return undefined
  let inner = trimmed.slice(head.length, trimmed.length - after.length)
  if (head !== before && inner.startsWith('\n')) {
    // A type broken straight after `type T =`, as a long union is: its lines, a step back.
    inner = inner.slice(1)
    indent += '  '
  } else if (head !== before) {
    if (!inner.startsWith(' ')) return undefined
    inner = inner.slice(1)
  }
  const lines = inner.split('\n')
  if (lines.some(line => line && !line.startsWith(indent))) return undefined
  return lines.map(line => line.slice(indent.length)).join('\n')
}

/** What a function's return type decorates, when it is a decorator: `method`, `class or method`. */
export type DecoratorTarget = 'class' | 'method' | 'property' | 'parameter' | 'class or method'

/** The Returns line for a decorator factory, before its full type. */
export const decoratorSummary = (target: DecoratorTarget) =>
  target === 'class or method' ? 'Returns a decorator for a class or a method.' : `Returns a ${target} decorator.`
