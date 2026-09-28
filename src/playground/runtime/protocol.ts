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

/**
 * A string of `min` to `max` UTF-16 code units, and well formed: a lone surrogate is in no text Discord sends,
 * and breaks what encodes it.
 */
const isText = (value: unknown, { min = 0, max = 4000 }: { min?: number; max?: number } = {}): value is string =>
  typeof value === 'string' && value.length >= min && value.length <= max && value.isWellFormed()

/** A component's or a modal field's custom ID: 1 to 100 characters, as Discord takes it. */
const isCustomId = (value: unknown): value is string => isText(value, { min: 1, max: 100 })

const SNOWFLAKE = /^[1-9]\d{0,19}$/
const MAX_SNOWFLAKE = 2n ** 64n - 1n

/** A Discord id: a decimal number with no leading zero, at most 2⁶⁴ − 1. */
export const isSnowflake = (value: unknown): value is string =>
  typeof value === 'string' && SNOWFLAKE.test(value) && BigInt(value) <= MAX_SNOWFLAKE

/**
 * A list of `min` to `max` strings, each passing `item`, or undefined when it isn't one. It is read by index,
 * so a hole is an item that fails; with `unique`, no string may come twice.
 */
function stringList(
  value: unknown,
  { min, max, item, unique = false }: { min: number; max: number; item: (each: unknown) => boolean; unique?: boolean },
): string[] | undefined {
  if (!Array.isArray(value) || value.length < min || value.length > max) return undefined
  const list: string[] = []
  for (let index = 0; index < value.length; index += 1) {
    const each: unknown = value[index]
    if (!item(each)) return undefined
    list.push(each as string)
  }
  return unique && new Set(list).size !== list.length ? undefined : list
}

function parseDispatch(value: unknown): Dispatch | string {
  if (!isRecord(value)) return 'each dispatch is an object'
  switch (value.kind) {
    case 'slash': {
      if (!isText(value.command, { min: 1, max: 100 })) return 'a slash dispatch names its command'
      if (value.options === undefined) return { kind: 'slash', command: value.command }
      if (!isRecord(value.options)) return "a slash dispatch's options are an object"
      const options: Record<string, string | number | boolean> = {}
      for (const [name, option] of Object.entries(value.options)) {
        if (!isText(name, { min: 1, max: 32 })) return 'an option is named in 1 to 32 characters'
        if (!(isText(option) || typeof option === 'number' || typeof option === 'boolean'))
          return `option ${name} is a string, a number or a boolean`
        options[name] = option
      }
      return { kind: 'slash', command: value.command, options }
    }
    case 'button':
      return isCustomId(value.customId) ? { kind: 'button', customId: value.customId } : 'a button names its customId'
    case 'select': {
      if (!isCustomId(value.customId)) return 'a select menu names its customId'
      const values = stringList(value.values, {
        min: 0,
        max: 25,
        item: each => isText(each, { min: 1, max: 100 }),
        unique: true,
      })
      if (!values) return "a select menu's values are up to 25 different strings"
      return { kind: 'select', customId: value.customId, values }
    }
    case 'userselect': {
      if (!isCustomId(value.customId)) return 'a user select menu names its customId'
      const users = stringList(value.users, { min: 1, max: 25, item: isSnowflake, unique: true })
      if (!users) return "a user select menu's users are 1 to 25 different snowflakes"
      return { kind: 'userselect', customId: value.customId, users }
    }
    case 'modal': {
      if (!isCustomId(value.customId)) return 'a modal names its customId'
      if (!isRecord(value.fields)) return "a modal's fields are strings by custom ID"
      const fields: Record<string, string> = {}
      for (const [id, field] of Object.entries(value.fields)) {
        if (!isCustomId(id) || !isText(field)) return "a modal's fields are strings by custom ID"
        fields[id] = field
      }
      return { kind: 'modal', customId: value.customId, fields }
    }
    case 'message':
      return isText(value.content, { max: 2000 })
        ? { kind: 'message', content: value.content }
        : 'a message has its content'
    case 'reaction': {
      if (!isText(value.emoji, { min: 1, max: 64 })) return 'a reaction names its emoji'
      if (!isText(value.content, { max: 2000 })) return "a reaction's message has its content"
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
  if (typeof data.source !== 'string' || !data.source.isWellFormed()) return 'the code is text'
  if (data.source.length > MAX_SOURCE_LENGTH)
    return `the code is over ${MAX_SOURCE_LENGTH.toLocaleString('en')} characters, the most a run takes`
  if (!Array.isArray(data.dispatch) || data.dispatch.length > MAX_STEPS)
    return `a run dispatches a list of up to ${MAX_STEPS} inputs`
  const dispatch: Dispatch[] = []
  // By index, so a hole is an input that fails
  for (let index = 0; index < data.dispatch.length; index += 1) {
    const parsed = parseDispatch(data.dispatch[index])
    if (typeof parsed === 'string') return parsed
    dispatch.push(parsed)
  }
  const request: RunRequest = { type: 'run', id: data.id, source: data.source, dispatch }
  if (data.caller !== undefined) {
    if (!isRecord(data.caller)) return 'the caller is an object'
    const { userId, username, inGuild } = data.caller
    if (userId !== undefined && !isSnowflake(userId)) return "the caller's userId is a snowflake"
    if (username !== undefined && !isText(username, { min: 1, max: 32 }))
      return "the caller's username is 1 to 32 characters"
    if (inGuild !== undefined && typeof inGuild !== 'boolean') return "the caller's inGuild is true or false"
    request.caller = { userId, username, inGuild }
  }
  if (data.controllers !== undefined) {
    const controllers = stringList(data.controllers, {
      min: 0,
      max: 50,
      item: each => isText(each, { min: 1, max: 100 }),
    })
    if (!controllers) return 'controllers are export names'
    request.controllers = controllers
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
  const handlers = stringList(value.handlers, { min: 0, max: 50, item: each => typeof each === 'string' })
  if (!handlers) return undefined
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
    handlers,
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
