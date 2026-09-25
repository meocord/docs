import { ChatInputCommandInteraction, User } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { GuardDeniedError } from 'meocord/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { BLOCKED_USER, PipelineSlashController, trace } from '@src/home/pipeline.slash.controller'

const call = (userId: string) => {
  const interaction = createMockInteraction(ChatInputCommandInteraction, {
    user: createMockInteraction(User, { id: userId }),
  })
  interaction.options = createChatInputOptions({ name: '  Ada  ' })
  return interaction
}

const module = MeoCordTestingModule.create({ controllers: [PipelineSlashController] }).compile()

describe('one call through the pipeline', () => {
  beforeEach(() => (trace.length = 0))

  it('defers, passes the guard, runs inside the interceptor with a trimmed option, and replies', async () => {
    const interaction = call('1')

    await expect(module.invoke(PipelineSlashController, 'greet', interaction)).resolves.toEqual({ ran: true })

    expect(trace.map(event => event.stage)).toEqual([
      'defer',
      'guard',
      'interceptor:before',
      'pipe',
      'interceptor:after',
    ])
    expect(trace.find(event => event.stage === 'pipe')?.note).toBe('"  Ada  " → "Ada"')
    expect(getResponse(interaction).calls.at(-1)?.payload).toMatchObject({ content: 'Hello, Ada!' })
  })

  // The bot's built-in fallback answers a GuardDeniedError privately; invoke leaves it to the caller.
  it('stops at the guard for a blocked user, with the reason the bot answers them with', async () => {
    const interaction = call(BLOCKED_USER)

    await expect(module.invoke(PipelineSlashController, 'greet', interaction)).rejects.toThrow(
      new GuardDeniedError('This command is for members.'),
    )

    expect(trace.map(event => event.stage)).toEqual(['defer', 'guard'])
    expect(trace.at(-1)?.note).toBe('denied')
    expect(getResponse(interaction).calls.some(recorded => recorded.method !== 'deferReply')).toBe(false)
  })
})
