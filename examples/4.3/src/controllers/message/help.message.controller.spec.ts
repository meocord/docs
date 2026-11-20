import { MeoCord } from 'meocord/decorator'
import { createMockMessage, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { HelpMessageController } from '@src/controllers/message/help.message.controller'
import { ModerationMessageController } from '@src/controllers/message/moderation.message.controller'

// The app's own help, with the built-in left off
@MeoCord({
  controllers: [ModerationMessageController, HelpMessageController],
  clientOptions: { intents: [] },
  messages: { prefix: '!' },
})
class OwnHelpApp {}

const replyTo = (message: ReturnType<typeof createMockMessage>) => message.reply.mock.calls[0]?.[0]

// #region spec
describe('HelpMessageController', () => {
  const module = MeoCordTestingModule.create({
    app: OwnHelpApp,
    controllers: [ModerationMessageController, HelpMessageController],
  }).compile()

  it('lists the commands from the model the built-in help uses, and shows one', async () => {
    const list = createMockMessage({ content: '!help' })
    await module.dispatch(list)
    expect(replyTo(list)).toContain('!mute <target> [duration] [reason…]')

    const one = createMockMessage({ content: '!help nope' })
    await module.dispatch(one)
    expect(replyTo(one)).toBe('There is no nope command.')
  })
})
// #endregion spec
