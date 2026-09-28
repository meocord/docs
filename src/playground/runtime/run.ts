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
    create(options: { controllers: Class[]; observers?: Class[] }): Builder
    fromApp(app: Class, options?: { controllers?: Class[]; observers?: Class[] }): Builder
  }
  createMockInteraction(type: unknown, overrides?: Record<string, unknown>): Record<string, unknown>
  createMockUser(props?: Record<string, unknown>): Record<string, unknown>
  createMockMessage(overrides?: Record<string, unknown>): Record<string, unknown>
  createChatInputOptions(options: Record<string, unknown>): unknown
  createModalFields(fields: Record<string, string>): unknown
  createMockGuild(overrides?: Record<string, unknown>): Record<string, unknown>
  getResponse(interaction: unknown): { calls: { method: string; payload?: unknown; error?: unknown }[] }
}
interface Builder {
  compile(): TestingModule
}
interface TestingModule {
  init(): Promise<unknown>
  close(): Promise<void>
  dispatch(input: unknown, options?: { user: unknown; action: unknown }): Promise<DispatchedCall>
  emit(event: string, ...args: unknown[]): Promise<{ ran: number }>
}
interface DispatchedCall {
  ran: boolean
  handlers: { controller: { name: string }; method: string }[]
  error?: unknown
}

/** What a dispatched input did, before its calls are read. */
interface Outcome {
  ran: boolean
  handlers: string[]
  error?: unknown
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

/** What an observer is told as a call reaches its handler: the controller and the method. */
interface StartedCall {
  getController(): { name: string } | undefined
  getHandlerName(): string | undefined
}

/**
 * An `@Observer` that notes each handler a call reaches, as MeoCord reports it: a dispatch that rejects,
 * for an error no filter handled, says nothing of the handler it ran, and this does.
 */
function handlerRecorder(observer: () => (target: Class) => void, reached: string[]): Class {
  class HandlerRecorder {
    onStart(context: StartedCall) {
      const controller = context.getController()?.name
      const method = context.getHandlerName()
      if (controller && method) reached.push(`${controller}.${method}`)
    }
    onSettled() {}
  }
  observer()(HandlerRecorder)
  return HandlerRecorder
}

/** What a run needs to turn one dispatch into a call: the modules, the module under test and the caller. */
interface Context {
  testing: Testing
  discord: Record<string, unknown>
  enums: { ReactionHandlerAction: { ADD: unknown; REMOVE: unknown } }
  module: TestingModule
  caller: { user: Record<string, unknown>; userId: string; username: string; inGuild: boolean }
  /** The handlers the recorder heard start for the current input. */
  reached: string[]
}

/** An input ready to send: how MeoCord receives it, and where what the handler answered is read from. */
interface Prepared {
  send(): Promise<Outcome>
  calls(): RecordedCall[]
}

const fromCall = (call: DispatchedCall): Outcome => ({
  ran: call.ran,
  handlers: call.handlers.map(each => `${each.controller.name}.${each.method}`),
  ...(call.error !== undefined && { error: call.error }),
})

/** An interaction's calls, as `getResponse` records them. */
const interactionCalls = (testing: Testing, interaction: unknown) => () =>
  testing.getResponse(interaction).calls.map(call => ({
    method: call.method,
    ...(call.payload !== undefined && { payload: toJson(call.payload) }),
    ...(call.error !== undefined && { error: describeError(call.error).message }),
  }))

/** The calls a mock's `method` received, such as a message's replies or a member's direct messages. */
const mockCalls = (target: Record<string, unknown>, method: string) => () =>
  ((target[method] as MockFn | undefined)?.mock.calls ?? []).map(args => ({ method, payload: toJson(args[0]) }))

/**
 * A user as MeoCord's own tests make one, a person and not a bot, with every default its mocks carry, named
 * as the run asks.
 */
function mockUser(testing: Testing, id: string, username: string): Record<string, unknown> {
  return testing.createMockUser({ id, username })
}

const CUSTOM_EMOJI = /^<(a?):(\w{2,32}):(\d{17,20})>$/

/**
 * A reaction's emoji as discord.js gives it: a server's own, written `<:name:id>` as Discord formats it, by its
 * name and id; any other, by its name alone.
 */
function emojiOf(written: string) {
  const custom = CUSTOM_EMOJI.exec(written)
  if (custom) {
    const [, animated, name, id] = custom
    return {
      name,
      id,
      animated: animated === 'a',
      identifier: `${animated ? 'a:' : ''}${name}:${id}`,
      toString: () => written,
    }
  }
  return { name: written, id: null, animated: false, identifier: encodeURIComponent(written), toString: () => written }
}

/** The playground's server, where a call comes from unless the caller is in a DM. */
const SERVER_NAME = 'MeoCord Playground'

/** A dispatch as MeoCord receives it, from the caller it comes from. */
function prepare(dispatch: Dispatch, context: Context): Prepared {
  const { testing, discord, module, caller } = context
  const { user } = caller
  const from = caller.inGuild
    ? { user, author: user }
    : { user, author: user, guild: null, guildId: null, member: null }
  const interaction = (type: string, overrides: Record<string, unknown>): Prepared => {
    const input = testing.createMockInteraction(discord[type], { ...from, ...overrides })
    return { send: async () => fromCall(await module.dispatch(input)), calls: interactionCalls(testing, input) }
  }
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
      return interaction('ChatInputCommandInteraction', {
        commandName: command,
        options: testing.createChatInputOptions({ ...nesting, ...dispatch.options }),
      })
    }
    case 'button':
      return interaction('ButtonInteraction', { customId: dispatch.customId })
    case 'select':
      return interaction('StringSelectMenuInteraction', { customId: dispatch.customId, values: dispatch.values })
    case 'userselect': {
      const Collection = discord.Collection as new (entries: [string, unknown][]) => unknown
      const users = new Collection(
        dispatch.users.map(id => [id, id === caller.userId ? user : mockUser(testing, id, `user-${id}`)]),
      )
      return interaction('UserSelectMenuInteraction', { customId: dispatch.customId, values: dispatch.users, users })
    }
    case 'modal':
      return interaction('ModalSubmitInteraction', {
        customId: dispatch.customId,
        fields: testing.createModalFields(dispatch.fields),
      })
    case 'message': {
      const message = testing.createMockMessage({ ...from, content: dispatch.content })
      return { send: async () => fromCall(await module.dispatch(message)), calls: mockCalls(message, 'reply') }
    }
    case 'reaction': {
      const message = testing.createMockMessage({ ...from, content: dispatch.content })
      const reaction = testing.createMockInteraction(discord.MessageReaction, {
        message,
        emoji: emojiOf(dispatch.emoji),
        count: 1,
      })
      const { ADD, REMOVE } = context.enums.ReactionHandlerAction
      const action = dispatch.action === 'add' ? ADD : REMOVE
      return {
        send: async () => fromCall(await module.dispatch(reaction, { user, action })),
        calls: mockCalls(message, 'reply'),
      }
    }
    case 'event': {
      const guild = testing.createMockGuild()
      guild.name = SERVER_NAME
      const member = testing.createMockInteraction(discord.GuildMember, {
        guild,
        user,
        id: caller.userId,
        displayName: caller.username,
      })
      return {
        // An event names no handler; the recorder heard which ran
        send: async () => {
          const { ran } = await module.emit(dispatch.event, member)
          return { ran: ran > 0, handlers: [...context.reached] }
        },
        calls: mockCalls(member, 'send'),
      }
    }
  }
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
  const { Observer } = modules['meocord/decorator'] as { Observer: () => (target: Class) => void }
  // The handlers the current input reached, as the recorder hears them
  const reached: string[] = []
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
    const observers = [handlerRecorder(Observer, reached)]
    testingModule = (
      app
        ? testing.MeoCordTestingModule.fromApp(app, { ...(named && { controllers: named }), observers })
        : testing.MeoCordTestingModule.create({ controllers: named ?? classes, observers })
    ).compile()
    await testingModule.init()
  } catch (error) {
    return failed('module', error)
  }

  const { userId = '100000000000000001', username = 'reader', inGuild = true } = request.caller ?? {}
  const enums = modules['meocord/enum'] as Context['enums']
  const steps: Step[] = []
  try {
    for (const dispatch of request.dispatch) {
      const user = mockUser(testing, userId, username)
      const context: Context = {
        testing,
        discord,
        enums,
        module: testingModule,
        caller: { user, userId, username, inGuild },
        reached,
      }
      let prepared: Prepared
      try {
        prepared = prepare(dispatch, context)
      } catch (error) {
        steps.push({ input: dispatch, ran: false, handlers: [], error: describeError(error), calls: [] })
        continue
      }
      reached.length = 0
      try {
        const outcome = await prepared.send()
        steps.push({
          input: dispatch,
          ran: outcome.ran,
          handlers: outcome.handlers,
          ...(outcome.error !== undefined && { error: describeError(outcome.error) }),
          calls: prepared.calls(),
        })
      } catch (error) {
        // An error no filter handled: the fallback has answered it, and dispatch rethrows it; the handler
        // that threw is the one the recorder heard start
        steps.push({
          input: dispatch,
          ran: reached.length > 0,
          handlers: [...reached],
          error: describeError(error),
          calls: prepared.calls(),
        })
      }
    }
  } finally {
    await testingModule.close().catch(() => undefined)
  }
  return fitted({ type: 'result', id: request.id, ok: true, steps, logs })
}
