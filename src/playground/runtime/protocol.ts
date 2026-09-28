/**
 * The messages between the playground's frame and the Worker that runs a reader's code. The frame
 * forwards what the page sends, so a request is parsed field by field before anything runs.
 */

/** The largest source a run compiles, in UTF-16 code units: several example files at once. */
export const MAX_SOURCE_LENGTH = 64_000
/** The most interactions one run dispatches. */
export const MAX_STEPS = 20
/** The largest result a run posts back, as JSON, beyond which its payloads are cut. */
export const MAX_RESULT_LENGTH = 256_000

/** Who an interaction or a message comes from, and where. */
export interface Caller {
  userId?: string
  username?: string
  /** Sent in a server, the default, or in a direct message. */
  inGuild?: boolean
}

/** One interaction or message to dispatch, as a reader describes it. */
export type Dispatch =
  | { kind: 'slash'; command: string; options?: Record<string, string | number | boolean> }
  | { kind: 'button'; customId: string }
  | { kind: 'select'; customId: string; values: string[] }
  | { kind: 'modal'; customId: string; fields: Record<string, string> }
  | { kind: 'message'; content: string }

export interface RunRequest {
  type: 'run'
  /** Echoed in the result, so a late answer to an earlier run is told apart. */
  id: number
  source: string
  dispatch: Dispatch[]
  caller?: Caller
  /** The exports to build as controllers; by default every exported class, or the `@MeoCord` app when one is. */
  controllers?: string[]
}

/** A Discord call a handler made, as `getResponse(...).calls` records it, in JSON. */
export interface RecordedCall {
  method: string
  payload?: unknown
  error?: string
}

/** What one dispatched input did. */
export interface Step {
  input: Dispatch
  ran: boolean
  /** Each handler reached, as `Controller.method`. */
  handlers: string[]
  error?: { name: string; message: string }
  calls: RecordedCall[]
}

export interface LogLine {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  text: string
}

export type RunResult =
  | { type: 'result'; id: number; ok: true; steps: Step[]; logs: LogLine[]; truncated?: true }
  | {
      type: 'result'
      id: number
      ok: false
      stage: 'request' | 'compile' | 'load' | 'module'
      message: string
      logs: LogLine[]
    }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isText = (value: unknown, max = 4000): value is string => typeof value === 'string' && value.length <= max

function parseDispatch(value: unknown): Dispatch | string {
  if (!isRecord(value)) return 'each dispatch is an object'
  switch (value.kind) {
    case 'slash': {
      if (!isText(value.command, 100) || value.command === '') return 'a slash dispatch names its command'
      if (value.options === undefined) return { kind: 'slash', command: value.command }
      if (!isRecord(value.options)) return "a slash dispatch's options are an object"
      const options: Record<string, string | number | boolean> = {}
      for (const [name, option] of Object.entries(value.options)) {
        if (!(isText(option) || typeof option === 'number' || typeof option === 'boolean'))
          return `option ${name} is a string, a number or a boolean`
        options[name] = option
      }
      return { kind: 'slash', command: value.command, options }
    }
    case 'button':
      return isText(value.customId, 100) ? { kind: 'button', customId: value.customId } : 'a button names its customId'
    case 'select':
      if (!isText(value.customId, 100)) return 'a select menu names its customId'
      if (!Array.isArray(value.values) || !value.values.every(each => isText(each, 100)) || value.values.length > 25)
        return "a select menu's values are up to 25 strings"
      return { kind: 'select', customId: value.customId, values: [...value.values] }
    case 'modal': {
      if (!isText(value.customId, 100)) return 'a modal names its customId'
      if (!isRecord(value.fields) || !Object.values(value.fields).every(each => isText(each)))
        return "a modal's fields are strings by custom ID"
      return { kind: 'modal', customId: value.customId, fields: { ...(value.fields as Record<string, string>) } }
    }
    case 'message':
      return isText(value.content, 2000) ? { kind: 'message', content: value.content } : 'a message has its content'
    default:
      return 'a dispatch is slash, button, select, modal or message'
  }
}

/**
 * A run request from whatever the frame was sent, or why it isn't one. Only the fields a run reads are
 * kept, so nothing else reaches the reader's code.
 */
export function parseRunRequest(data: unknown): RunRequest | string {
  if (!isRecord(data) || data.type !== 'run') return 'not a run request'
  if (typeof data.id !== 'number' || !Number.isSafeInteger(data.id)) return 'a run request has a numeric id'
  if (!isText(data.source, MAX_SOURCE_LENGTH))
    return `the code is over ${MAX_SOURCE_LENGTH.toLocaleString('en')} characters, the most a run takes`
  if (!Array.isArray(data.dispatch) || data.dispatch.length > MAX_STEPS)
    return `a run dispatches a list of up to ${MAX_STEPS} inputs`
  const dispatch: Dispatch[] = []
  for (const each of data.dispatch) {
    const parsed = parseDispatch(each)
    if (typeof parsed === 'string') return parsed
    dispatch.push(parsed)
  }
  const request: RunRequest = { type: 'run', id: data.id, source: data.source, dispatch }
  if (data.caller !== undefined) {
    if (!isRecord(data.caller)) return 'the caller is an object'
    const { userId, username, inGuild } = data.caller
    if (userId !== undefined && !(isText(userId, 20) && /^\d+$/.test(userId)))
      return "the caller's userId is a snowflake"
    if (username !== undefined && !isText(username, 32)) return "the caller's username is up to 32 characters"
    if (inGuild !== undefined && typeof inGuild !== 'boolean') return "the caller's inGuild is true or false"
    request.caller = { userId, username, inGuild }
  }
  if (data.controllers !== undefined) {
    if (!Array.isArray(data.controllers) || !data.controllers.every(each => isText(each, 100)))
      return 'controllers are export names'
    request.controllers = [...data.controllers]
  }
  return request
}
