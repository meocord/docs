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
/** How long a run may take once it starts, in milliseconds, before the frame stops its Worker. */
export const RUN_TIME_LIMIT = 5_000

/** Who an interaction or a message comes from, and where. */
export interface Caller {
  userId?: string
  username?: string
  /** Sent in a server, the default, or in a direct message. */
  inGuild?: boolean
}

/**
 * The gateway events a run can emit, each with the caller as its one argument: the member who joined or
 * left, in the playground's server.
 */
export const PLAYGROUND_EVENTS = ['guildMemberAdd', 'guildMemberRemove'] as const

/** One interaction, message, reaction or gateway event to dispatch, as a reader describes it. */
export type Dispatch =
  | { kind: 'slash'; command: string; options?: Record<string, string | number | boolean> }
  | { kind: 'button'; customId: string }
  | { kind: 'select'; customId: string; values: string[] }
  | { kind: 'userselect'; customId: string; users: string[] }
  | { kind: 'modal'; customId: string; fields: Record<string, string> }
  | { kind: 'message'; content: string }
  /** The caller reacting with `emoji` to a message of `content`, or taking the reaction back. */
  | { kind: 'reaction'; emoji: string; content: string; action: 'add' | 'remove' }
  | { kind: 'event'; event: (typeof PLAYGROUND_EVENTS)[number] }

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

export const LOG_LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const

export interface LogLine {
  level: (typeof LOG_LEVELS)[number]
  text: string
}

/**
 * Where a run that failed stopped: its request, compiling, loading or building the module, as the Worker
 * reports it; `timeout` and `runtime` when the frame stopped the Worker or the Worker could not start.
 */
export const FAILED_STAGES = ['request', 'compile', 'load', 'module', 'timeout', 'runtime'] as const

export type RunResult =
  | { type: 'result'; id: number; ok: true; steps: Step[]; logs: LogLine[]; truncated?: true }
  | {
      type: 'result'
      id: number
      ok: false
      stage: (typeof FAILED_STAGES)[number]
      message: string
      logs: LogLine[]
    }

/** What the frame posts to the page: that it is ready for a run, then each run's result. */
export type FrameMessage = { type: 'ready' } | RunResult

/** What the Worker posts as it starts a run, its compiler ready: the frame's time limit starts then. */
export interface RunStarted {
  type: 'started'
  id: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)

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
    case 'userselect': {
      if (!isText(value.customId, 100)) return 'a user select menu names its customId'
      if (
        !Array.isArray(value.users) ||
        value.users.length === 0 ||
        value.users.length > 25 ||
        !value.users.every(each => isText(each, 20) && /^\d+$/.test(each))
      )
        return "a user select menu's users are 1 to 25 snowflakes"
      return { kind: 'userselect', customId: value.customId, users: [...value.users] }
    }
    case 'reaction': {
      if (!isText(value.emoji, 64) || value.emoji === '') return 'a reaction names its emoji'
      if (!isText(value.content, 2000)) return "a reaction's message has its content"
      if (value.action !== 'add' && value.action !== 'remove') return "a reaction's action is add or remove"
      return { kind: 'reaction', emoji: value.emoji, content: value.content, action: value.action }
    }
    case 'event':
      return PLAYGROUND_EVENTS.includes(value.event as (typeof PLAYGROUND_EVENTS)[number])
        ? { kind: 'event', event: value.event as (typeof PLAYGROUND_EVENTS)[number] }
        : `an event is ${PLAYGROUND_EVENTS.join(' or ')}`
    default:
      return 'a dispatch is slash, button, select, userselect, modal, message, reaction or event'
  }
}

/**
 * A run request from whatever the frame was sent, or why it isn't one. Only the fields a run reads are
 * kept, so nothing else reaches the reader's code.
 */
export function parseRunRequest(data: unknown): RunRequest | string {
  if (!isRecord(data) || data.type !== 'run') return 'not a run request'
  if (!isId(data.id)) return 'a run request has a numeric id'
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

function parseLogs(value: unknown): LogLine[] | undefined {
  if (!Array.isArray(value)) return undefined
  const logs: LogLine[] = []
  for (const line of value) {
    if (!isRecord(line) || !LOG_LEVELS.includes(line.level as LogLine['level']) || typeof line.text !== 'string')
      return undefined
    logs.push({ level: line.level as LogLine['level'], text: line.text })
  }
  return logs
}

function parseStep(value: unknown): Step | undefined {
  if (!isRecord(value) || typeof value.ran !== 'boolean') return undefined
  const input = parseDispatch(value.input)
  if (typeof input === 'string') return undefined
  if (!Array.isArray(value.handlers) || !value.handlers.every(each => typeof each === 'string')) return undefined
  const { error } = value
  if (error !== undefined && !(isRecord(error) && typeof error.name === 'string' && typeof error.message === 'string'))
    return undefined
  if (!Array.isArray(value.calls)) return undefined
  const calls: RecordedCall[] = []
  for (const call of value.calls) {
    if (!isRecord(call) || typeof call.method !== 'string') return undefined
    if (call.error !== undefined && typeof call.error !== 'string') return undefined
    calls.push({
      method: call.method,
      ...(call.payload !== undefined && { payload: call.payload }),
      ...(call.error !== undefined && { error: call.error }),
    })
  }
  return {
    input,
    ran: value.ran,
    handlers: [...value.handlers],
    ...(error !== undefined && { error: { name: error.name as string, message: error.message as string } }),
    calls,
  }
}

/**
 * A result for the run `id` from whatever the Worker posted, or undefined when it isn't one. The reader's
 * code runs in that Worker and can post too, so a result is rebuilt from the fields a result has, its
 * payloads as plain JSON, and one past the size a run posts is refused.
 */
export function parseRunResult(data: unknown, id: number): RunResult | undefined {
  if (!isRecord(data) || data.type !== 'result' || data.id !== id || typeof data.ok !== 'boolean') return undefined
  const logs = parseLogs(data.logs)
  if (!logs) return undefined
  let result: RunResult
  if (data.ok) {
    if (!Array.isArray(data.steps) || data.steps.length > MAX_STEPS) return undefined
    const steps: Step[] = []
    for (const each of data.steps) {
      const step = parseStep(each)
      if (!step) return undefined
      steps.push(step)
    }
    if (data.truncated !== undefined && data.truncated !== true) return undefined
    result = { type: 'result', id, ok: true, steps, logs, ...(data.truncated && { truncated: true }) }
  } else {
    if (!FAILED_STAGES.includes(data.stage as (typeof FAILED_STAGES)[number]) || typeof data.message !== 'string')
      return undefined
    result = {
      type: 'result',
      id,
      ok: false,
      stage: data.stage as (typeof FAILED_STAGES)[number],
      message: data.message,
      logs,
    }
  }
  let json: string
  try {
    json = JSON.stringify(result)
  } catch {
    return undefined
  }
  return json.length <= MAX_RESULT_LENGTH ? (JSON.parse(json) as RunResult) : undefined
}

/** Whether the Worker posted that it started the run `id`. */
export const isRunStarted = (data: unknown, id: number): data is RunStarted =>
  isRecord(data) && data.type === 'started' && data.id === id
