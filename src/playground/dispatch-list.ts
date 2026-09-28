/**
 * The inputs a `::playground` directive dispatches, written as a reader would send them, one step per
 * `;`: `/settings notify email enabled:true note:'hi there'; button counter/1; select pick a,b;
 * modal feedback about='bugs'; message !ping`. A first step `as dm` or `as user:13 name:ada` sets who
 * they come from. Quotes are single, since the list sits in a double-quoted attribute.
 */
import { type Caller, type Dispatch, MAX_STEPS, parseRunRequest } from './runtime/protocol'

export interface DispatchList {
  steps: Dispatch[]
  caller?: Caller
}

/** Splits `text` on `separator` outside single quotes; a quote left open is an error. */
function split(text: string, separator: RegExp): string[] | undefined {
  const parts: string[] = []
  let current = ''
  let quoted = false
  for (const char of text) {
    if (char === "'") quoted = !quoted
    if (!quoted && separator.test(char)) {
      parts.push(current)
      current = ''
    } else current += char
  }
  if (quoted) return undefined
  parts.push(current)
  return parts
}

/** A word with its quotes removed: `'hi there'` is `hi there`. */
const unquote = (word: string) => word.replace(/^'([\s\S]*)'$/, '$1')

/** `name:value` or `name=value`, split at the first separator outside quotes. */
function pair(word: string, separator: ':' | '='): [string, string] | undefined {
  const at = word.indexOf(separator)
  if (at <= 0) return undefined
  const name = word.slice(0, at)
  return /^[\w-]+$/.test(name) ? [name, word.slice(at + 1)] : undefined
}

/** A slash command option's value as the reader typed it: a boolean, a number, or text. */
function optionValue(raw: string): string | number | boolean {
  if (raw.startsWith("'")) return unquote(raw)
  if (raw === 'true' || raw === 'false') return raw === 'true'
  return /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw
}

function parseStep(step: string): Dispatch | Caller | string {
  if (step.startsWith('/')) {
    const words = split(step.slice(1), /\s/)!.filter(Boolean)
    const path: string[] = []
    const options: Record<string, string | number | boolean> = {}
    for (const word of words) {
      const option = pair(word, ':')
      if (option) options[option[0]] = optionValue(option[1])
      else if (Object.keys(options).length > 0) return `"${word}" follows the options; the command's path comes first`
      else path.push(word)
    }
    if (path.length === 0) return 'a slash command names its command after the /'
    if (path.length > 3) return 'a slash command is a command, a subcommand group and a subcommand at most'
    return Object.keys(options).length > 0
      ? { kind: 'slash', command: path.join(' '), options }
      : { kind: 'slash', command: path.join(' ') }
  }
  const [keyword, ...rest] = split(step, /\s/)!.filter(Boolean)
  switch (keyword) {
    case 'button': {
      if (rest.length !== 1) return 'a button step is `button <customId>`'
      return { kind: 'button', customId: unquote(rest[0]) }
    }
    case 'select': {
      if (rest.length === 0) return 'select needs a customId'
      if (rest.length !== 2) return 'a select step is `select <customId> <value>,<value>`'
      const values = split(rest[1], /,/)!.map(unquote).filter(Boolean)
      if (values.length === 0 || values.length > 25) return 'a select step picks 1 to 25 values'
      return { kind: 'select', customId: unquote(rest[0]), values }
    }
    case 'modal': {
      if (rest.length === 0) return 'modal needs a customId'
      const fields: Record<string, string> = {}
      for (const word of rest.slice(1)) {
        const field = pair(word, '=')
        if (!field) return `"${word}" is not a field; a modal step is \`modal <customId> <field>='<text>'\``
        fields[field[0]] = unquote(field[1])
      }
      return { kind: 'modal', customId: unquote(rest[0]), fields }
    }
    case 'message': {
      const content = step.slice('message'.length).trim()
      if (!content) return 'a message step is `message <content>`'
      return { kind: 'message', content: unquote(content) }
    }
    case 'as': {
      const caller: Caller = {}
      for (const word of rest) {
        if (word === 'dm') caller.inGuild = false
        else if (pair(word, ':')?.[0] === 'user' && /^\d+$/.test(pair(word, ':')![1]))
          caller.userId = pair(word, ':')![1]
        else if (pair(word, ':')?.[0] === 'name') caller.username = unquote(pair(word, ':')![1])
        else return `"${word}" is not a caller; a caller is \`as dm\`, \`user:<id>\` or \`name:<name>\``
      }
      return rest.length > 0 ? caller : 'an `as` step names the caller: `as dm`, `as user:13 name:ada`'
    }
    default:
      return `"${keyword ?? ''}" starts no step; a step is /command, button, select, modal or message`
  }
}

/**
 * The steps a `dispatch` attribute names, or why it names none: each error says which step it is in,
 * such as `dispatch step 2: select needs a customId`.
 */
export function parseDispatchList(text: string): DispatchList | string {
  const steps = split(text, /;/)?.map(step => step.trim())
  if (!steps) return 'dispatch: a quote is left open'
  if (steps.every(step => !step)) return 'dispatch: names no step'
  const list: DispatchList = { steps: [] }
  for (const [index, step] of steps.entries()) {
    const where = `dispatch step ${index + 1}`
    if (!step) return `${where}: is empty`
    const parsed = parseStep(step)
    if (typeof parsed === 'string') return `${where}: ${parsed}`
    if (!('kind' in parsed)) {
      if (index > 0) return `${where}: \`as\` sets the caller for the whole run, so it comes first`
      list.caller = parsed
      continue
    }
    list.steps.push(parsed)
  }
  if (list.steps.length === 0) return 'dispatch: names no step to run'
  if (list.steps.length > MAX_STEPS)
    return `dispatch: names ${list.steps.length} steps, over the ${MAX_STEPS} a run takes`
  // The frame parses every request again; a list it would refuse is refused here, with its reason
  const request = parseRunRequest({ type: 'run', id: 0, source: '', dispatch: list.steps, caller: list.caller })
  return typeof request === 'string' ? `dispatch: ${request}` : list
}
