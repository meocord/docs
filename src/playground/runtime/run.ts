import {
  type Dispatch,
  type LogLine,
  MAX_RESULT_LENGTH,
  type RecordedCall,
  type RunRequest,
  type RunResult,
  type Step,
} from './protocol'

/** The packages a reader's code may import, by specifier: the pinned runtime's own modules. */
export type ModuleMap = Readonly<Record<string, unknown>>

/** Turns the reader's TypeScript into CommonJS with legacy decorators and their metadata, or throws. */
export type Compile = (source: string) => string

export interface RunEnvironment {
  modules: ModuleMap
  compile: Compile
  /** Where the reader's and MeoCord's logging lands during the run. */
  logs: LogLine[]
}

type Class = abstract new (...args: never[]) => unknown
type MockFn = { mock: { calls: unknown[][] } }

/** The parts of `meocord/testing` a run drives. */
interface Testing {
  MeoCordTestingModule: {
    create(options: { controllers: Class[] }): Builder
    fromApp(app: Class, options?: { controllers?: Class[] }): Builder
  }
  createMockInteraction(type: unknown, overrides?: Record<string, unknown>): Record<string, unknown>
  createMockMessage(overrides?: Record<string, unknown>): Record<string, unknown>
  createChatInputOptions(options: Record<string, unknown>): unknown
  createModalFields(fields: Record<string, string>): unknown
  getResponse(interaction: unknown): { calls: { method: string; payload?: unknown; error?: unknown }[] }
}
interface Builder {
  compile(): TestingModule
}
interface TestingModule {
  init(): Promise<unknown>
  close(): Promise<void>
  dispatch(
    input: unknown,
  ): Promise<{ ran: boolean; handlers: { controller: { name: string }; method: string }[]; error?: unknown }>
}

/** The specifiers a reader may import, which every run names when it refuses another. */
const allowed = (modules: ModuleMap) => Object.keys(modules).sort().join(', ')

/** The longest log line, error message or payload a result carries whole. */
const CLIP = 2000

const clip = (text: string) =>
  text.length > CLIP ? `${text.slice(0, CLIP)}… [cut: ${text.length.toLocaleString('en')} characters]` : text

const describeError = (error: unknown): { name: string; message: string } =>
  error instanceof Error
    ? { name: clip(String(error.name)), message: clip(String(error.message)) }
    : { name: 'Error', message: clip(String(error)) }

/** A value as JSON: bigints as strings, functions left out, a repeated object named rather than walked again. */
function toJson(value: unknown): unknown {
  const seen = new WeakSet<object>()
  const text = JSON.stringify(value, (_key, each: unknown) => {
    if (typeof each === 'bigint') return each.toString()
    if (typeof each === 'function' || typeof each === 'symbol') return undefined
    if (typeof each === 'object' && each !== null) {
      if (seen.has(each)) return '[Circular]'
      seen.add(each)
    }
    return each
  })
  return text === undefined ? undefined : (JSON.parse(text) as unknown)
}

/** Evaluates compiled CommonJS against the module map, refusing any import outside it. */
function load(code: string, modules: ModuleMap): Record<string, unknown> {
  const exports: Record<string, unknown> = {}
  const require = (id: string) => {
    if (!Object.hasOwn(modules, id))
      throw new Error(`Cannot import '${id}' in the playground: it runs ${allowed(modules)} only.`)
    return modules[id]
  }
  new Function('require', 'exports', 'module', code)(require, exports, { exports })
  return exports
}

/** The `@MeoCord` app among a module's exports, by the metadata its decorator records. */
function appOf(exports: Record<string, unknown>, appOptionsKey: string): Class | undefined {
  const reflect = Reflect as unknown as { getMetadata?: (key: string, target: object) => unknown }
  return Object.values(exports).find(
    (value): value is Class => typeof value === 'function' && reflect.getMetadata?.(appOptionsKey, value) !== undefined,
  )
}

/** The mock interaction or message a dispatch describes, from the caller it comes from. */
function inputFor(
  dispatch: Dispatch,
  testing: Testing,
  discord: Record<string, unknown>,
  from: Record<string, unknown>,
) {
  const interaction = (type: string, overrides: Record<string, unknown>) =>
    testing.createMockInteraction(discord[type], { ...from, ...overrides })
  switch (dispatch.kind) {
    case 'slash': {
      // `settings notify email` is the command, then a subcommand group and a subcommand, as Discord sends it
      const [command, ...path] = dispatch.command.trim().split(/\s+/)
      const nesting =
        path.length === 2
          ? { subcommandGroup: path[0], subcommand: path[1] }
          : path.length === 1
            ? { subcommand: path[0] }
            : {}
      const input = interaction('ChatInputCommandInteraction', { commandName: command })
      input.options = testing.createChatInputOptions({ ...nesting, ...dispatch.options })
      return input
    }
    case 'button':
      return interaction('ButtonInteraction', { customId: dispatch.customId })
    case 'select':
      return interaction('StringSelectMenuInteraction', { customId: dispatch.customId, values: dispatch.values })
    case 'modal':
      return interaction('ModalSubmitInteraction', {
        customId: dispatch.customId,
        fields: testing.createModalFields(dispatch.fields),
      })
    case 'message':
      return testing.createMockMessage({ ...from, content: dispatch.content })
  }
}

/** What an input was answered with: an interaction's recorded calls, or a message's replies. */
function callsOf(dispatch: Dispatch, input: Record<string, unknown>, testing: Testing): RecordedCall[] {
  if (dispatch.kind !== 'message')
    return testing.getResponse(input).calls.map(call => ({
      method: call.method,
      ...(call.payload !== undefined && { payload: toJson(call.payload) }),
      ...(call.error !== undefined && { error: describeError(call.error).message }),
    }))
  const reply = input.reply as MockFn | undefined
  return (reply?.mock.calls ?? []).map(args => ({ method: 'reply', payload: toJson(args[0]) }))
}

/**
 * A result that fits the posting limit: each payload, message and log line that makes it too long is cut,
 * then the calls past a step's first 20 and the logs before the last 100, and the result says so. One
 * still too long is a failure the reader can act on.
 */
export function fitted(result: RunResult): RunResult {
  const fits = (each: RunResult) => JSON.stringify(each).length <= MAX_RESULT_LENGTH
  if (fits(result)) return result
  const logs = result.logs.slice(-100).map(line => ({ ...line, text: clip(line.text) }))
  const cut: RunResult = result.ok
    ? {
        ...result,
        steps: result.steps.map(step => ({
          ...step,
          calls: step.calls.slice(0, 20).map(call => {
            const length = JSON.stringify(call.payload ?? null).length
            return length > CLIP ? { ...call, payload: `[cut: ${length.toLocaleString('en')} characters]` } : call
          }),
        })),
        logs,
        truncated: true,
      }
    : { ...result, message: clip(result.message), logs }
  if (fits(cut)) return cut
  return {
    type: 'result',
    id: result.id,
    ok: false,
    stage: 'runtime',
    message: `The run's result is over ${MAX_RESULT_LENGTH.toLocaleString('en')} characters even cut down: dispatch fewer inputs, or answer with less.`,
    logs: [],
  }
}

/**
 * Runs a reader's code as the bot would handle it: compiles it, loads it against the pinned modules,
 * builds a testing module from its controllers or its `@MeoCord` app, and dispatches each input in turn.
 * A failure before the first dispatch ends the run with the stage it failed at; a failing dispatch is
 * recorded in its step, and the next still runs.
 */
export async function runPlayground(
  request: RunRequest,
  { modules, compile, logs }: RunEnvironment,
): Promise<RunResult> {
  const failed = (stage: 'compile' | 'load' | 'module', error: unknown): RunResult =>
    fitted({ type: 'result', id: request.id, ok: false, stage, message: describeError(error).message, logs })

  let code: string
  try {
    code = compile(request.source)
  } catch (error) {
    return failed('compile', error)
  }

  let exports: Record<string, unknown>
  try {
    exports = load(code, modules)
  } catch (error) {
    return failed('load', error)
  }

  const testing = modules['meocord/testing'] as Testing
  const discord = modules['discord.js'] as Record<string, unknown>
  const { MetadataKey } = modules['meocord/enum'] as { MetadataKey: { AppOptions: string } }
  let testingModule: TestingModule
  try {
    const app = appOf(exports, MetadataKey.AppOptions)
    const named = request.controllers?.map(name => {
      const value = exports[name]
      if (typeof value !== 'function') throw new Error(`The code exports no class named ${name}.`)
      return value as Class
    })
    const classes = Object.values(exports).filter(
      (value): value is Class => typeof value === 'function' && value !== app,
    )
    testingModule = (
      app
        ? testing.MeoCordTestingModule.fromApp(app, named && { controllers: named })
        : testing.MeoCordTestingModule.create({ controllers: named ?? classes })
    ).compile()
    await testingModule.init()
  } catch (error) {
    return failed('module', error)
  }

  const { userId = '100000000000000001', username = 'reader', inGuild = true } = request.caller ?? {}
  const steps: Step[] = []
  try {
    for (const dispatch of request.dispatch) {
      const user = testing.createMockInteraction(discord.User, { id: userId, username })
      const from = inGuild ? { user, author: user } : { user, author: user, guild: null, guildId: null, member: null }
      let input: Record<string, unknown>
      try {
        input = inputFor(dispatch, testing, discord, from)
      } catch (error) {
        steps.push({ input: dispatch, ran: false, handlers: [], error: describeError(error), calls: [] })
        continue
      }
      try {
        const outcome = await testingModule.dispatch(input)
        steps.push({
          input: dispatch,
          ran: outcome.ran,
          handlers: outcome.handlers.map(each => `${each.controller.name}.${each.method}`),
          ...(outcome.error !== undefined && { error: describeError(outcome.error) }),
          calls: callsOf(dispatch, input, testing),
        })
      } catch (error) {
        // An error no filter handled: the fallback has answered it, and dispatch rethrows it
        steps.push({
          input: dispatch,
          ran: false,
          handlers: [],
          error: describeError(error),
          calls: callsOf(dispatch, input, testing),
        })
      }
    }
  } finally {
    await testingModule.close().catch(() => undefined)
  }
  return fitted({ type: 'result', id: request.id, ok: true, steps, logs })
}
