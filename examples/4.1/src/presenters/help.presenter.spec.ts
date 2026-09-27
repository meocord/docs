import { type EmbedBuilder } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { createMockMessage, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ModerationMessageController } from '@src/controllers/message/moderation.message.controller'
import { HelpPresenter } from '@src/presenters/help.presenter'

@MeoCord({
  controllers: [ModerationMessageController],
  clientOptions: { intents: [] },
  messages: { prefix: '!', help: true },
  presenter: HelpPresenter,
})
class HelpApp {}

describe('HelpPresenter', () => {
  it('writes the built-in help as an embed', async () => {
    const module = MeoCordTestingModule.create({ app: HelpApp, controllers: [ModerationMessageController] }).compile()
    const message = createMockMessage({ content: '!help' })

    await module.dispatch(message)

    const [sent] = message.reply.mock.calls[0] as [{ embeds: EmbedBuilder[] }]
    expect(sent.embeds[0].data.title).toBe('Commands')
    expect(sent.embeds[0].data.description).toContain('`!mute <target> [duration] [reason…]`')
  })
})
