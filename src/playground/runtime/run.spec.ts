import { beforeAll, describe, expect, it } from 'vitest'
import { compile, pinnedModules } from '../../../tests/playground'
import { MAX_RESULT_LENGTH, type Dispatch, type LogLine, type RunResult } from './protocol'
import { fitted, type ModuleMap, runPlayground } from './run'

let modules: ModuleMap

beforeAll(async () => {
  modules = await pinnedModules('4.1')
})

const run = (source: string, dispatch: Dispatch[], extra: Record<string, unknown> = {}) => {
  const logs: LogLine[] = []
  return runPlayground({ type: 'run', id: 7, source, dispatch, ...extra }, { modules, compile, logs })
}
const ok = (result: RunResult) => {
  if (!result.ok) throw new Error(`${result.stage}: ${result.message}`)
  return result
}

const COUNTER = `
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type ButtonInteraction, type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { respond, useTheme } from 'meocord/common'
import { Command, CommandBuilder, Controller, Service, UseTheme } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@CommandBuilder(CommandType.SLASH)
export class CounterBuilder {
  build(name: string) {
    return new SlashCommandBuilder().setName(name).setDescription('Start a counter')
  }
}

@Service()
export class Counter {
  label(count: number) {
    return 'Count: ' + count
  }
}

@Controller()
@UseTheme({ colors: { primary: '#26A042' } })
export class CounterController {
  constructor(private readonly counter: Counter) {}

  @Command('counter', CounterBuilder)
  async start(interaction: ChatInputCommandInteraction) {
    const button = new ButtonBuilder().setCustomId('counter/1').setLabel('+1').setStyle(ButtonStyle.Primary)
    await respond(interaction).send({
      content: this.counter.label(0),
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
    })
  }

  @Command('counter/{count}', CommandType.BUTTON)
  async add(interaction: ButtonInteraction, { count }: { count: string }) {
    const before = useTheme().colors.primary
    await Promise.resolve()
    await respond(interaction).send({ content: this.counter.label(Number(count)) + ' ' + before + ' ' + useTheme().colors.primary })
  }
}
`

describe('runPlayground', () => {
  it('runs a slash command and its button through dispatch, a service injected and the theme kept across await', async () => {
    const result = ok(
      await run(COUNTER, [
        { kind: 'slash', command: 'counter' },
        { kind: 'button', customId: 'counter/1' },
      ]),
    )
    expect(result.id).toBe(7)
    const [slash, button] = result.steps
    expect(slash).toMatchObject({ ran: true, handlers: ['CounterController.start'] })
    expect(slash.calls[0]).toMatchObject({ method: 'reply', payload: { content: 'Count: 0' } })
    expect(button).toMatchObject({ ran: true, handlers: ['CounterController.add'] })
    expect(button.calls[0]).toMatchObject({ method: 'update', payload: { content: 'Count: 1 #26A042 #26A042' } })
  })

  it('records a refused call in its step, and runs the next input', async () => {
    const source = `
import { type ButtonInteraction } from 'discord.js'
import { GuardDeniedError, respond, UserError } from 'meocord/common'
import { Command, Controller, Guard, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Guard()
export class NotBanned {
  canActivate(interaction: ButtonInteraction) {
    if (interaction.user.id === '13') throw new GuardDeniedError('You are banned.')
    return true
  }
}

@Controller()
export class Refusing {
  @Command('guarded', CommandType.BUTTON)
  @UseGuard(NotBanned)
  async guarded(interaction: ButtonInteraction) {
    await respond(interaction).send({ content: 'passed' })
  }

  @Command('refuse', CommandType.BUTTON)
  refuse() {
    throw new UserError('Link your account first.')
  }
}
`
    const result = ok(
      await run(
        source,
        [
          { kind: 'button', customId: 'guarded' },
          { kind: 'button', customId: 'refuse' },
        ],
        {
          caller: { userId: '13' },
        },
      ),
    )
    expect(result.steps[0]).toMatchObject({
      ran: false,
      error: { name: 'GuardDeniedError', message: 'You are banned.' },
    })
    expect(result.steps[1]).toMatchObject({ error: { name: 'UserError', message: 'Link your account first.' } })
    expect(result.steps[1].calls.length).toBeGreaterThan(0)
  })

  it("records an error no filter handles, with the fallback's answer", async () => {
    const source = `
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Broken {
  @Command('boom', CommandType.BUTTON)
  boom() {
    throw new Error('kaput')
  }
}
`
    const result = ok(await run(source, [{ kind: 'button', customId: 'boom' }]))
    expect(result.steps[0]).toMatchObject({ ran: true, handlers: ['Broken.boom'], error: { message: 'kaput' } })
    expect(result.steps[0].calls[0]?.method).toBeDefined()
  })

  it('names the handler that threw after answering, with what it sent before', async () => {
    const source = `
import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Halfway {
  @Command('halfway', CommandType.SLASH)
  async halfway(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({ content: 'first' })
    throw new Error('then this')
  }
}
`
    const result = ok(
      await run(source, [
        { kind: 'slash', command: 'halfway' },
        { kind: 'button', customId: 'nowhere' },
      ]),
    )
    expect(result.steps[0]).toMatchObject({ ran: true, handlers: ['Halfway.halfway'], error: { message: 'then this' } })
    expect(result.steps[0].calls[0]).toMatchObject({ method: 'reply', payload: { content: 'first' } })
    // The next input starts with nothing heard
    expect(result.steps[1]).toMatchObject({ ran: false, handlers: [] })
  })

  it('answers an input nothing routes as the bot does', async () => {
    const result = ok(await run(COUNTER, [{ kind: 'button', customId: 'nowhere' }]))
    expect(result.steps[0]).toMatchObject({ ran: false, handlers: [], error: { name: 'CommandNotFoundError' } })
  })

  it('passes select values and modal fields, and runs in a DM when the caller says so', async () => {
    const source = `
import { type ModalSubmitInteraction, type StringSelectMenuInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Forms {
  @Command('pick', CommandType.SELECT_MENU)
  async pick(interaction: StringSelectMenuInteraction, { values }: { values: string[] }) {
    await respond(interaction).send({ content: values.join('+') + ' in ' + (interaction.inGuild() ? 'a server' : 'a DM') })
  }

  @Command('form', CommandType.MODAL_SUBMIT)
  async form(interaction: ModalSubmitInteraction, { about }: { about: string }) {
    await respond(interaction).send({ content: 'about ' + about })
  }
}
`
    const result = ok(
      await run(
        source,
        [
          { kind: 'select', customId: 'pick', values: ['a', 'b'] },
          { kind: 'modal', customId: 'form', fields: { about: 'bugs' } },
        ],
        { caller: { inGuild: false } },
      ),
    )
    expect(result.steps[0].calls[0]).toMatchObject({ payload: { content: 'a+b in a DM' } })
    expect(result.steps[1].calls[0]).toMatchObject({ payload: { content: 'about bugs' } })
  })

  it("builds a @MeoCord app when the code exports one, with its message prefix, and records a message's reply", async () => {
    const source = `
import { type Message } from 'discord.js'
import { Controller, MeoCord, MessageHandler } from 'meocord/decorator'
@Controller()
export class Ping {
  @MessageHandler('ping')
  async ping(message: Message) {
    await message.reply('pong')
  }
}
@MeoCord({ controllers: [Ping], clientOptions: { intents: [] }, messages: { prefix: '!' } })
export class App {}
`
    const result = ok(await run(source, [{ kind: 'message', content: '!ping' }]))
    expect(result.steps[0]).toMatchObject({ ran: true, handlers: ['Ping.ping'] })
    expect(result.steps[0].calls).toEqual([{ method: 'reply', payload: 'pong' }])
  })

  it('runs a slash command by its full path, with its options', async () => {
    const source = `
import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Settings {
  @Command('settings notify email', CommandType.SLASH)
  async email(interaction: ChatInputCommandInteraction, { enabled }: { enabled: boolean }) {
    await respond(interaction).send({ content: 'email ' + enabled })
  }
}
`
    const result = ok(
      await run(source, [{ kind: 'slash', command: 'settings notify email', options: { enabled: true } }]),
    )
    expect(result.steps[0]).toMatchObject({ ran: true, handlers: ['Settings.email'] })
    expect(result.steps[0].calls[0]).toMatchObject({ payload: { content: 'email true' } })
  })

  it('stops at the stage that fails: compiling, loading, an import outside the list, or building the module', async () => {
    expect(await run('export const = 1', [])).toMatchObject({ ok: false, stage: 'compile' })
    expect(await run("import { readFileSync } from 'fs'\nexport const x = readFileSync", [])).toMatchObject({
      ok: false,
      stage: 'load',
      message: expect.stringMatching(
        /^Cannot import 'fs' in the playground: it runs discord\.js, meocord\/common, .*reflect-metadata only\.$/,
      ),
    })
    const badCooldown = `
import { Controller, Command, Cooldown } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class C {
  @Command('x', CommandType.BUTTON)
  @Cooldown({ seconds: -1 })
  x() {}
}
`
    expect(await run(badCooldown, [])).toMatchObject({ ok: false, stage: 'load' })
    expect(await run(COUNTER, [], { controllers: ['Missing'] })).toMatchObject({
      ok: false,
      stage: 'module',
      message: 'The code exports no class named Missing.',
    })
  })

  it('cuts payloads that would make the result too long, and says so', async () => {
    const source = `
import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Big {
  @Command('big', CommandType.BUTTON)
  async big(interaction: ButtonInteraction) {
    await respond(interaction).send({ content: 'x'.repeat(2000), embeds: Array.from({ length: 10 }, () => ({ description: 'y'.repeat(4000) })) })
  }
}
`
    const dispatch = Array.from({ length: 12 }, (): Dispatch => ({ kind: 'button', customId: 'big' }))
    const result = ok(await run(source, dispatch))
    expect(result.truncated).toBe(true)
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(MAX_RESULT_LENGTH)
    expect(result.steps[0].calls[0].payload).toMatch(/^\[cut: [\d,]+ characters\]$/)
  })
})

describe('fitted', () => {
  it('cuts long log lines and messages, and keeps the last logs, when a result is over the limit', () => {
    const logs = Array.from({ length: 300 }, (_, index) => ({
      level: 'log' as const,
      text: `${index} ${'z'.repeat(5000)}`,
    }))
    const failure = fitted({ type: 'result', id: 1, ok: false, stage: 'load', message: 'm'.repeat(10_000), logs })
    expect(JSON.stringify(failure).length).toBeLessThanOrEqual(MAX_RESULT_LENGTH)
    expect(failure).toMatchObject({
      ok: false,
      stage: 'load',
      message: expect.stringMatching(/… \[cut: 10,000 characters\]$/),
    })
    expect(failure.logs).toHaveLength(100)
    expect(failure.logs[0].text).toMatch(/^200 z+… \[cut: 5,004 characters\]$/)
  })

  it('leaves a result that fits as it is, and fails one that cannot be cut to fit', () => {
    const small = { type: 'result' as const, id: 1, ok: true as const, steps: [], logs: [] }
    expect(fitted(small)).toBe(small)
    const handlers = Array.from({ length: 2000 }, (_, index) => `Controller${index}.${'h'.repeat(100)}`)
    const step = { input: { kind: 'button' as const, customId: 'x' }, ran: true, handlers, calls: [] }
    expect(fitted({ ...small, steps: [step, step] })).toMatchObject({
      ok: false,
      stage: 'runtime',
      message: expect.stringContaining('dispatch fewer inputs'),
    })
  })
})

it('clips an error message a handler throws, so one step never fills the result', async () => {
  const source = `
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Loud {
  @Command('loud', CommandType.BUTTON)
  loud() {
    throw new Error('a'.repeat(50_000))
  }
}
`
  const result = ok(await run(source, [{ kind: 'button', customId: 'loud' }]))
  expect(result.steps[0].error?.message).toMatch(/^a{2000}… \[cut: 50,000 characters\]$/)
})
