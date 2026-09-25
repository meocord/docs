/**
 * Runs the home page's example call twice, as a member and as a blocked user, and prints what each
 * run did as JSON. The docs site's `bun run home:trace` writes it to generated/home/trace.json.
 */
import 'reflect-metadata'
import { ChatInputCommandInteraction, User } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
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

const recorded = {
  command: '/greet',
  option: { name: '  Ada  ' },
  member: await run('1'),
  blocked: await run(BLOCKED_USER),
}
process.stdout.write(`${JSON.stringify(recorded, null, 2)}\n`)
