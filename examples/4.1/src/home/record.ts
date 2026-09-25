/**
 * Runs the home page's example call twice, as a member and as a blocked user, then the calls behind
 * its feature rows, and prints what each did as JSON. The docs site's `bun run home:trace` writes it
 * to generated/home/trace.json.
 */
import 'reflect-metadata'
import { ChatInputCommandInteraction, User } from 'discord.js'
import { CommandType } from 'meocord/enum'
import {
  createChatInputOptions,
  createMockInteraction,
  getResponse,
  MeoCordTestingModule,
  resolveRoute,
} from 'meocord/testing'
import AppWithPresenter from '@src/app-with-presenter'
import { DailySlashController } from '@src/controllers/slash/daily.slash.controller'
import { QuoteSlashController } from '@src/controllers/slash/quote.slash.controller'
import { RemindSlashController } from '@src/controllers/slash/remind.slash.controller'
import { BLOCKED_USER, PipelineSlashController, trace } from '@src/home/pipeline.slash.controller'

const module = MeoCordTestingModule.create({ controllers: [PipelineSlashController] }).compile()

async function run(userId: string) {
  trace.length = 0
  const interaction = createMockInteraction(ChatInputCommandInteraction, {
    user: createMockInteraction(User, { id: userId }),
  })
  interaction.options = createChatInputOptions({ name: '  Ada  ' })
  try {
    const { ran } = await module.invoke(PipelineSlashController, 'greet', interaction)
    const reply = getResponse(interaction).calls.at(-1)?.payload as { content?: string } | undefined
    return { ran, events: [...trace], reply: reply?.content ?? null, error: null }
  } catch (error) {
    const { name, message } = error as Error
    return { ran: false, events: [...trace], reply: null, error: { name, message } }
  }
}

const from = (id: string) =>
  createMockInteraction(ChatInputCommandInteraction, { user: createMockInteraction(User, { id }) })
const refusal = (call: Promise<unknown>) =>
  call.then(
    () => null,
    (error: Error) => ({ name: error.name, message: error.message }),
  )

// Which handler a button's customId reaches, and what its pattern captured.
async function routing() {
  const customId = 'card/111/refresh'
  const route = resolveRoute(AppWithPresenter, { type: CommandType.BUTTON, customId })
  return { customId, handler: route && `${route.controller.name}.${route.method}`, params: route?.params ?? null }
}

// The second /daily inside three seconds, which the fallback answers privately with the error's message.
async function cooldown() {
  const daily = MeoCordTestingModule.create({ controllers: [DailySlashController] }).compile()
  await daily.invoke(DailySlashController, 'daily', from('1'))
  return { command: '/daily', refused: await refusal(daily.invoke(DailySlashController, 'daily', from('1'))) }
}

// A /remind the schema refuses, which the fallback answers privately with the error's message.
async function validation() {
  const remind = MeoCordTestingModule.create({ controllers: [RemindSlashController] }).compile()
  const interaction = createMockInteraction(ChatInputCommandInteraction)
  interaction.options = createChatInputOptions({ minutes: 0 })
  return {
    command: '/remind minutes: 0',
    refused: await refusal(remind.invoke(RemindSlashController, 'remind', interaction)),
  }
}

// The answer a filter gives, drawn by the app's presenter.
async function presenter() {
  const quotes = MeoCordTestingModule.create({ controllers: [QuoteSlashController], app: AppWithPresenter }).compile()
  await quotes.invoke(QuoteSlashController, 'quote', from('1'))
  const limited = from('1')
  await quotes.invoke(QuoteSlashController, 'quote', limited)
  return { command: '/quote', answer: getResponse(limited).calls.at(-1)?.payload ?? null }
}

const recorded = {
  command: '/greet',
  option: { name: '  Ada  ' },
  member: await run('1'),
  blocked: await run(BLOCKED_USER),
  features: {
    routing: await routing(),
    cooldown: await cooldown(),
    validation: await validation(),
    presenter: await presenter(),
  },
}
process.stdout.write(`${JSON.stringify(recorded, null, 2)}\n`)
