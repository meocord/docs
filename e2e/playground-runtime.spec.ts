import { readFileSync } from 'node:fs'
import path from 'node:path'
import { type Page } from '@playwright/test'
import { expect, test } from './test'

// The runtimes the build wrote, as the site will embed them
const manifest = JSON.parse(readFileSync('.playground/manifest.json', 'utf8')) as {
  swc: string
  lines: { line: string; version: string; runtime: string }[]
}
const runtime = manifest.lines.find(each => each.line === '4.1')!.runtime

/**
 * Starts the 4.1 runtime as the playground's frame will: in a document served from the site under the
 * frame's policy, sandboxed to an opaque origin, a classic blob Worker that is told where the compiler is,
 * then loads the bundle with importScripts from the site.
 */
async function startRuntime(page: Page, origin: string): Promise<string[]> {
  const frame = `${origin}/__playground-runtime-test`
  await page.route(frame, route =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>runtime</title>',
      headers: {
        'content-security-policy': [
          'sandbox allow-scripts',
          "default-src 'none'",
          `script-src ${origin} 'wasm-unsafe-eval' 'unsafe-eval' blob:`,
          'worker-src blob:',
          `connect-src ${origin}`,
        ].join('; '),
      },
    }),
  )
  // The stand-in frame comes from the router, not the network, so Chromium gives it no local address space
  // and would refuse its requests to this server; the runtime and compiler are fetched from it here instead,
  // bytes and headers unchanged
  const loaded: string[] = []
  await page.context().route(`${origin}/playground/**`, async route => {
    loaded.push(new URL(route.request().url()).pathname)
    await route.fulfill({ response: await route.fetch() })
  })
  await page.goto(frame)
  await page.evaluate(
    ({ runtime, swc, origin }) => {
      const boot = `self.__playground = { wasm: ${JSON.stringify(origin + swc)} }; importScripts(${JSON.stringify(origin + runtime)})`
      const worker = new Worker(URL.createObjectURL(new Blob([boot], { type: 'text/javascript' })))
      const waiting = new Map<number, (result: unknown) => void>()
      // The Worker says when each run starts, for the frame's time limit; the result comes after
      worker.onmessage = event => event.data.type === 'result' && waiting.get(event.data.id)?.(event.data)
      Object.assign(window, {
        __run: (request: { id: number }) =>
          new Promise(resolve => waiting.set(request.id, resolve)).finally(() => waiting.delete(request.id)),
        __post: (request: unknown) => worker.postMessage(request),
      })
    },
    { runtime, swc: manifest.swc, origin },
  )
  return loaded
}

let next = 1
/** Posts a run to the Worker and waits for its answer. */
async function run(page: Page, request: Record<string, unknown>) {
  const id = next++
  return page.evaluate(
    async ({ request, id }) => {
      const { __run, __post } = window as unknown as {
        __run: (request: { id: number }) => Promise<unknown>
        __post: (request: unknown) => void
      }
      const answer = __run({ id })
      __post({ type: 'run', id, dispatch: [], ...request })
      return answer
    },
    { request, id },
  ) as Promise<
    Record<string, unknown> & {
      steps: (Record<string, unknown> & { calls: unknown[] })[]
      logs: { level: string; text: string }[]
    }
  >
}

const COUNTER = `
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js'
import { respond, useTheme } from 'meocord/common'
import { Command, Controller, Service, UseTheme } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

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

  @Command('counter', CommandType.SLASH)
  async start(interaction: ChatInputCommandInteraction) {
    const button = new ButtonBuilder().setCustomId('counter/1').setLabel('+1').setStyle(ButtonStyle.Primary)
    await respond(interaction).send({ embeds: [{ description: this.counter.label(0) }], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)] })
  }

  @Command('counter/{count}', CommandType.BUTTON)
  async add(interaction: ButtonInteraction, { count }: { count: string }) {
    const before = useTheme().colors.primary
    await new Promise(resolve => setTimeout(resolve, 10))
    await respond(interaction).send({ content: this.counter.label(Number(count)) + ' ' + before + ' ' + useTheme().colors.primary })
  }
}
`

const PIPELINE = `
import { type ButtonInteraction } from 'discord.js'
import { GuardDeniedError, respond, UserError } from 'meocord/common'
import { Command, Controller, Cooldown, Defer, Guard, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Guard()
export class NotBanned {
  canActivate(interaction: ButtonInteraction) {
    if (interaction.user.id === '13') throw new GuardDeniedError('You are banned.')
    return true
  }
}

@Controller()
export class Pipeline {
  @Command('slow', CommandType.BUTTON)
  @UseGuard(NotBanned)
  @Cooldown({ seconds: 30 })
  @Defer()
  async slow(interaction: ButtonInteraction) {
    await new Promise(resolve => setTimeout(resolve, 20))
    await respond(interaction).send({ content: 'done' })
  }

  @Command('refuse', CommandType.BUTTON)
  refuse() {
    throw new UserError('Link your account first.')
  }
}
`

test.describe('the playground runtime', () => {
  test('loads only its bundle and the compiler, and runs a controller through dispatch with the theme kept across awaits', async ({
    page,
    baseURL,
  }) => {
    const loaded = await startRuntime(page, baseURL!)
    const result = await run(page, {
      source: COUNTER,
      dispatch: [
        { kind: 'slash', command: 'counter' },
        { kind: 'button', customId: 'counter/1' },
      ],
    })
    expect(result).toMatchObject({ ok: true })
    const [slash, button] = result.steps
    expect(slash).toMatchObject({ ran: true, handlers: ['CounterController.start'] })
    expect(slash.calls).toEqual([
      expect.objectContaining({
        method: 'reply',
        payload: expect.objectContaining({
          embeds: [expect.objectContaining({ description: 'Count: 0', color: 0x26a042 })],
        }),
      }),
    ])
    // AsyncLocalStorage over lowered async: the handler's theme before and after an await
    expect(button.calls[0]).toMatchObject({ method: 'update', payload: { content: 'Count: 1 #26A042 #26A042' } })
    expect(loaded.sort()).toEqual([manifest.swc, runtime].sort())
    // The logs are MeoCord's own line for each call, and nothing of the runtime's, such as a warning from
    // starting the compiler
    expect(result.logs.map(line => `${line.level} ${line.text.replace(/^.* \[LOG\] /, '')}`)).toEqual([
      'log [TestingModule] [INTERACTION] [SLASH] [start]',
      'log [TestingModule] [INTERACTION] [BUTTON] [add]',
    ])
  })

  test('runs guards, cooldowns, @Defer and a UserError as the bot does', async ({ page, baseURL }) => {
    await startRuntime(page, baseURL!)
    const result = await run(page, {
      source: PIPELINE,
      dispatch: [
        { kind: 'button', customId: 'slow' },
        { kind: 'button', customId: 'slow' },
        { kind: 'button', customId: 'refuse' },
      ],
    })
    expect(result).toMatchObject({ ok: true })
    const [first, second, refused] = result.steps
    expect(first).toMatchObject({ ran: true })
    // Acknowledged before the guard, then answered; a message with no components has nothing to lock
    expect(first.calls).toEqual([
      { method: 'deferUpdate' },
      expect.objectContaining({ method: 'editReply', payload: expect.objectContaining({ content: 'done' }) }),
    ])
    expect(second).toMatchObject({ ran: false, error: { name: 'CooldownError' } })
    expect(refused).toMatchObject({ error: { name: 'UserError', message: 'Link your account first.' } })

    const banned = await run(page, {
      source: PIPELINE,
      dispatch: [{ kind: 'button', customId: 'slow' }],
      caller: { userId: '13' },
    })
    expect(banned.steps[0]).toMatchObject({ ran: false, error: { name: 'GuardDeniedError' } })
  })

  test("refuses an import outside the allow-list, names a decoration's error, and keeps MeoCord's log lines", async ({
    page,
    baseURL,
  }) => {
    await startRuntime(page, baseURL!)
    expect(
      await run(page, { source: "import { readFileSync } from 'node:fs'\nexport const f = readFileSync" }),
    ).toMatchObject({
      ok: false,
      stage: 'load',
      message: expect.stringContaining("Cannot import 'node:fs' in the playground"),
    })
    expect(
      await run(page, {
        source:
          "import { Cooldown, Controller, Command } from 'meocord/decorator'\nimport { CommandType } from 'meocord/enum'\n@Controller() export class C { @Command('x', CommandType.BUTTON) @Cooldown({ seconds: -1 }) x() {} }",
      }),
    ).toMatchObject({ ok: false, stage: 'load' })
    expect(await run(page, { source: 'export const = 1' })).toMatchObject({ ok: false, stage: 'compile' })

    const unrouted = await run(page, { source: COUNTER, dispatch: [{ kind: 'button', customId: 'nowhere' }] })
    expect(unrouted.steps[0]).toMatchObject({ error: { name: 'CommandNotFoundError' } })
    expect(unrouted.logs.some(line => line.level === 'warn' && line.text.includes('nowhere'))).toBe(true)
    expect(unrouted.logs.every(line => !line.text.includes('\u001b['))).toBe(true)
  })

  test('runs a reaction, a gateway event and a user select from the Guide as the bot does', async ({
    page,
    baseURL,
  }) => {
    await startRuntime(page, baseURL!)
    const example = (file: string) => readFileSync(path.join('examples/4.1/src', file), 'utf8')
    const reaction = await run(page, {
      source: example('controllers/reaction/star.reaction.controller.ts'),
      dispatch: [{ kind: 'reaction', emoji: '⭐', content: 'A good post', action: 'add' }],
      caller: { username: 'mika' },
    })
    expect(reaction.steps[0]).toMatchObject({ ran: true, handlers: ['StarReactionController.star'] })
    expect(reaction.steps[0].calls).toEqual([{ method: 'reply', payload: 'mika starred this.' }])
    const event = await run(page, {
      source: example('controllers/event/welcome.controller.ts'),
      dispatch: [{ kind: 'event', event: 'guildMemberAdd' }],
    })
    expect(event.steps[0]).toMatchObject({ ran: true, handlers: ['WelcomeController.greet'] })
    expect(event.steps[0].calls).toEqual([{ method: 'send', payload: 'Welcome to MeoCord Playground!' }])
    const select = await run(page, {
      source: example('controllers/select-menu/assign.select-menu.controller.ts'),
      dispatch: [{ kind: 'userselect', customId: 'assign/7', users: ['100000000000000001', '14'] }],
    })
    expect(select.steps[0].calls[0]).toMatchObject({ payload: { content: 'Task 7 is assigned to reader, user-14.' } })
  })

  test('answers a malformed request without running anything', async ({ page, baseURL }) => {
    await startRuntime(page, baseURL!)
    const answer = await page.evaluate(async () => {
      const { __run, __post } = window as unknown as {
        __run: (request: { id: number }) => Promise<unknown>
        __post: (request: unknown) => void
      }
      const waiting = __run({ id: 999 })
      __post({ type: 'run', id: 999, source: 'export {}', dispatch: [{ kind: 'eval', code: 'alert(1)' }] })
      return waiting
    })
    expect(answer).toEqual({
      type: 'result',
      id: 999,
      ok: false,
      stage: 'request',
      message: 'a dispatch is slash, button, select, userselect, modal, message, reaction or event',
      logs: [],
    })
  })
})
