import path from 'node:path'
import ts from 'typescript'
import { beforeAll, describe, expect, it } from 'vitest'
import { MAX_RESULT_LENGTH, type Dispatch, type LogLine, type RunResult } from './protocol'
import { type ModuleMap, runPlayground } from './run'

// The 4.1 line's pinned packages, as the playground's runtime bundles them
const pinned = path.resolve(__dirname, '../../../examples/4.1/node_modules')
let modules: ModuleMap

beforeAll(async () => {
  await import(path.join(pinned, 'reflect-metadata/Reflect.js'))
  const entry = (name: string) => import(path.join(pinned, 'meocord/dist/esm', name, 'index.js'))
  modules = {
    'discord.js': await import(path.join(pinned, 'discord.js/src/index.js')),
    'meocord/common': await entry('common'),
    'meocord/decorator': await entry('decorator'),
    'meocord/enum': await entry('enum'),
    'meocord/interface': await entry('interface'),
    'meocord/testing': await entry('testing'),
    'reflect-metadata': {},
  }
})

// What swc does in the browser: legacy decorators with their metadata, as CommonJS
const compile = (source: string) => {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  })
  const error = diagnostics?.find(each => each.category === ts.DiagnosticCategory.Error)
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'))
  return outputText
}

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
    expect(result.steps[0]).toMatchObject({ ran: false, error: { message: 'kaput' } })
    expect(result.steps[0].calls[0]?.method).toBeDefined()
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
